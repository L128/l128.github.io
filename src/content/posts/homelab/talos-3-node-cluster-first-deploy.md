---
author: L128
pubDatetime: 2026-05-10T00:00:00.000+08:00
title: "3 节点 Talos 集群初次部署:从 k3s 走向不可变 OS"
featured: true
draft: false
tags:
  - homelab
  - talos
  - kubernetes
  - proxmox
  - ansible
description: "在 Proxmox 上用 Ansible 自动化拉起 3 节点 Talos 集群,记录设计决策、与 k3s 的核心差异、混合云前置考量和最终落地的 playbook 结构。"
---
# 3 节点Talos集群初次部署

> **来源**: LOU-23 · LOU-50
> **迁移 Dry Run**: LOU-60

## 背景

基于 Proxmox 虚拟化环境，使用 Ansible 自动化脚本部署 3 节点Talos Linux 集群。目标是为后续从现有 k3s + FluxCD 栈迁移到 Talos 积累经验，作为混合云（Hybrid Cloud）部署的 dry run。

### 设计决策

- **控制平面**: 1 个 control node（满足初始需求，为后续扩展留余地）
- **工作节点**: 2 个 worker nodes
- **架构**: 3 节点总计（1 control + 2 worker）
- **混合云考量**: 暂时不需要大于 1 个 control node，后续可按需扩展

## Talos 简介

Talos Linux 是一个专为 Kubernetes 设计的最小化、不可变（immutable）操作系统：

- **不可变基础设施**: 系统镜像只读，配置通过 API 声明式管理
- **安全加固**: 最小化攻击面，无 SSH、无 shell、无包管理器
- **声明式配置**: 通过 `machineconfig` YAML 文件定义集群状态
- **Talosctl CLI**: 官方命令行工具，用于集群管理和配置

## k3s → Talos 迁移对比

### 核心差异

| 维度 | k3s | Talos Linux |
|------|-----|-------------|
| **系统性质** | 标准 Linux + k3s 二进制 | 不可变 OS，K8s 组件内建于系统 |
| **配置方式** | 修改 `/etc/rancher/k3s/config.yaml` + systemctl | `talosctl` API + `machineconfig` YAML |
| **更新机制** | 替换二进制 + 重启服务 | 滚动镜像升级（immutable upgrade） |
| **安全模型** | 标准 Linux 安全（SSH、sudo） | 无 SSH、无 shell、mTLS 通信 |
| **CNI** | 内置 Flannel（默认） | 需手动选择（Calico/Cilium/Flannel） |
| **存储** | Local Path Provisioner | 需集成外部方案（Longhorn/Ceph） |
| **Ingress** | Traefik（内置） | 需自行部署（Traefik/NGINX/Cilium） |
| **集群管理** | `kubectl` + k3s CLI | `talosctl` + `kubectl` |

### 迁移策略

```
┌─────────────────────────────────────────────────────────────┐
│                    迁移阶段概览                               │
│                                                             │
│  Phase 1: Dry Run (当前)                                     │
│  ├─ Proxmox 上部署 3 节点Talos集群                          │
│  ├─ 验证基本 K8s 功能                                         │
│  └─ 记录部署经验与踩坑点                                       │
│                                                             │
│  Phase 2: 应用迁移准备                                        │
│  ├─ 盘点现有 k3s  workload（Deployments/Services/ConfigMaps） │
│  ├─ FluxCD GitOps 适配（Talos 对 FluxCD 友好）                 │
│  └─ 存储方案选型（Longhorn vs Ceph）                           │
│                                                             │
│  Phase 3: 生产迁移                                            │
│  ├─ 双集群并行运行期                                           │
│  ├─ 流量切换（DNS/LoadBalancer）                               │
│  └─ 回滚预案                                                   │
└─────────────────────────────────────────────────────────────┘
```

### 迁移风险点

- **存储迁移**: Longhorn 从 k3s 迁移到 Talos 需要数据同步策略
- **网络策略**: Calico/Cilium 的 NetworkPolicy 需要重新验证
- **证书管理**: Talos 使用内置 CA，与 k3s 的证书体系不同
- **FluxCD 适配**: 现有 FluxCD 配置基本可复用，但需注意 cluster issuer 差异
- **etcd 高可用**: 当前 dry run 为单 control plane，生产需 3 节点

## 架构设计

```
┌─────────────────────────────────────────────────┐
│                  Proxmox Cluster                 │
│                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │  talos-ctl-0 │  │  talos-wkr-0 │  │  talos-wkr-1 ││
│  │  (control)   │  │  (worker)    │  │  (worker)    ││
│  │  1 Control   │  │  2 Workers   │  │              ││
│  │  Plane       │  │              │  │              ││
│  └─────────────┘  └─────────────┘  └─────────────┘│
│         │                │                │        │
│         └────────────────┴────────────────┘        │
│                    Cluster Network                  │
└─────────────────────────────────────────────────────┘
```

### 节点规划

| 节点名 | 角色 | vCPU | 内存 | 存储 | 用途 |
|--------|------|------|------|------|------|
| talos-ctl-0 | control plane | 2+ | 4GB+ | 20GB+ | Kubernetes 控制平面 |
| talos-wkr-0 | worker | 2+ | 4GB+ | 20GB+ | 工作负载 |
| talos-wkr-1 | worker | 2+ | 4GB+ | 20GB+ | 工作负载 |

> ⚠️ **资源需求**: Talos 官方最低要求为 control plane 节点 2 vCPU / 2GB RAM，worker 节点 2 vCPU / 2GB RAM。生产环境建议适当提高配置。

## Ansible 部署方案

### 前置准备

1. **Proxmox 环境**: 确保 Proxmox VE 集群可用，有 API Token 用于自动化
2. **Talos 镜像**: 下载 Talos Linux ISO 或 raw 镜像
3. **Ansible 控制节点**: 运行 Ansible 的机器（可以是管理节点或 Proxmox 本身）
4. **网络配置**: 确保所有节点在同一网络，可互相通信

### Ansible 角色结构

```
ansible/
├── inventory/
│   └── hosts.yml              # 定义节点和变量
├── roles/
│   ├── talos-vm-create/       # 在 Proxmox 上创建 Talos VM
│   ├── talos-bootstrap/       # 初始化 Talos集群
│   └── talos-kubeconfig/      # 生成 kubeconfig
├── site.yml                   # 主 playbook
└── group_vars/
    └── all.yml                # 全局变量
```

### 关键配置步骤

#### 1. 创建 Talos VM（Proxmox）

使用 Ansible `proxmox` 模块或 `qm` CLI 创建虚拟机：

```yaml
# 关键 VM 配置
- 使用 Talos ISO 作为启动镜像
- 设置正确的 CPU 类型（推荐 host）
- 启用 QEMU Agent（可选，用于健康检查）
- 网络: 连接到 Proxmox bridge（vmbr0 或自定义）
```

#### 2. 生成 Talos 配置

使用 `talosctl` 生成集群配置：

```bash
# 生成初始集群配置
talosctl gen cluster "talos-cluster" \
  --endpoints <control-node-ip> \
  --output-dir ./talos-config

# 这会生成:
# - cluster.yaml: 集群配置
# - init.yaml: init 节点配置（首个 control plane）
# - controlplane.yaml: 其他 control plane 配置
# - worker.yaml: worker 节点配置
```

#### 3. 应用配置到节点

```bash
# 应用到 init 节点（首个 control plane）
talosctl apply-config \
  --insecure \
  --endpoint <control-node-ip> \
  --node <control-node-ip> \
  -f ./talos-config/init.yaml

# 应用到 worker 节点
talosctl apply-config \
  --insecure \
  --endpoint <control-node-ip> \
  --node <worker-node-ip> \
  -f ./talos-config/worker.yaml
```

#### 4. 初始化集群

```bash
# 等待节点启动
talosctl --talosconfig ./talos-config/talosconfig get nodes

# 引导集群（仅在首个 control plane 上执行）
talosctl bootstrap \
  --talosconfig ./talos-config/talosconfig \
  --endpoints <control-node-ip> \
  --node <control-node-ip>
```

#### 5. 获取 kubeconfig

```bash
# 生成 kubeconfig
talosctl kubeconfig \
  --talosconfig ./talos-config/talosconfig \
  --force \
  --node <control-node-ip>
```

## 网络配置

### 端口清单

| 端口 | 协议 | 用途 | 范围 |
|------|------|------|------|
| 6443 | TCP | Kubernetes API Server | 全网 |
| 2379-2380 | TCP | etcd client/server | CP 节点间 |
| 50000 | TCP | Talos Node API | 管理网 |
| 10250 | TCP | Kubelet API | 内部 |
| 10256 | TCP | Kube-proxy | 内部 |
| CNI 端口 | 根据所选 CNI | Calico: 179/tcp, 4789/udp; Cilium: VXLAN | 全网 |

### 网络要求

- **API Server**: 6443/tcp（控制平面通信）
- **Talos API**: 50000/tcp（Talos 节点管理）
- **CNI 网络**: 根据所选 CNI 而定（默认 Calico: 179/tcp, 4789/udp）
- **节点间通信**: 所有节点间需要双向通信

### 推荐 CNI

Talos 支持多种 CNI 插件，常用选项：

| CNI | 特点 | 适用场景 |
|-----|------|----------|
| Calico | 功能丰富，支持 NetworkPolicy；BGP 模式无需 VXLAN | 生产环境 |
| Cilium | eBPF 驱动，高性能，内置 L7 策略和 Hubble 可观测性 | 需要高级网络策略 |
| Flannel | 简单轻量，默认 vxlan backend | 测试/开发环境 |

## 验证部署

### 检查集群状态

```bash
# 检查节点状态
kubectl get nodes

# 检查系统组件
kubectl get pods -n kube-system

# 检查 Talos 组件
talosctl --talosconfig ./talos-config/talosconfig get services
```

### 运行测试

```bash
# 运行 Kubernetes conformance 测试
# 或使用 kubectl 部署测试应用
kubectl create deployment nginx --image=nginx
kubectl expose deployment nginx --port=80 --type=ClusterIP
```

## 混合云扩展考量

### 当前设计（单 control plane）

- 满足初始部署需求
- 降低资源消耗
- 简化运维复杂度

### 未来扩展方向

1. **增加 control plane 节点**: 从 1 个扩展到 3 个，实现高可用
2. **混合云接入**: 将 Talos集群与其他云环境（如公有云 K8s）连接
3. **多集群管理**: 使用 FluxCD 或 Rancher 进行多集群统一管理
4. **服务网格**: 引入 Istio 或 Linkerd 实现跨集群服务治理

## 参考资源

- [Talos Linux 官方文档](https://www.talos.dev/docs/)
- [Talos Ansible 示例](https://github.com/siderolabs/terraform-examples)
- [Proxmox Ansible 模块](https://docs.ansible.com/ansible/latest/collections/community/proxmox/)
- Proxmox集群安装
- 虚拟机模板创建
- Bootstrap（FluxCD 引导流程）

## 注意事项

- ⚠️ Talos 是不可变系统，所有配置变更都需要通过 `talosctl` API 进行
- ⚠️ 确保 Proxmox VM 的网络配置正确，节点间能互相通信
- ⚠️ 生产环境建议至少 3 个 control plane 节点以实现 etcd 高可用
- ⚠️ 混合云部署需考虑网络延迟和带宽限制

---
*最后更新: 2026-05-10*
