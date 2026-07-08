/**
 * LABS MODULE: Definitions for the interactive scenarios.
 * Aggregates split LABS data chunks and keeps terminal fixture globals stable.
 */

const LABS = window.AEGIS_LABS = Object.assign(
  {},
  window.AEGIS_LABS_PARTS?.fabric_and_partitioning || {},
  window.AEGIS_LABS_PARTS?.runtime_and_training || {},
  window.AEGIS_LABS_PARTS?.network_and_storage || {},
  window.AEGIS_LABS_PARTS?.operations_and_schedulers || {}
);

const TERMINAL_OUTPUT = {
  topo: [
    {t:'cmd',  v:'$ nvidia-smi topo -m'},
    {t:'dim',  v:'        GPU0  GPU1  GPU2  GPU3  GPU4  GPU5  GPU6  GPU7  CPU Affinity'},
    {t:'good', v:'GPU0     X    NV4   NV4   NV4   NV4   NV4   NV4   NV4   0-95'},
    {t:'good', v:'GPU1    NV4    X    NV4   NV4   NV4   NV4   NV4   NV4   0-95'},
    {t:'good', v:'GPU2    NV4   NV4    X    NV4   NV4   NV4   NV4   NV4   0-95'},
    {t:'good', v:'GPU3    NV4   NV4   NV4    X    NV4   NV4   NV4   NV4   0-95'},
    {t:'good', v:'GPU4    NV4   NV4   NV4   NV4    X    NV4   NV4   NV4   96-191'},
    {t:'good', v:'GPU5    NV4   NV4   NV4   NV4   NV4    X    NV4   NV4   96-191'},
    {t:'good', v:'GPU6    NV4   NV4   NV4   NV4   NV4   NV4    X    NV4   96-191'},
    {t:'good', v:'GPU7    NV4   NV4   NV4   NV4   NV4   NV4   NV4    X    96-191'},
    {t:'good', v:'NV4 = connected via NVLink (4 links) ✓'}
  ],
  nvlink_err: [
    {t:'cmd',  v:'$ nvidia-smi nvlink -e'},
    {t:'good', v:'GPU 0, Link 0: CRC FLIT Error Count: 0'},
    {t:'good', v:'GPU 0, Link 0: Replay Error Count:   0'},
    {t:'good', v:'GPU 1, Link 2: CRC FLIT Error Count: 0'},
    {t:'good', v:'GPU 1, Link 2: Replay Error Count:   0'},
    {t:'good', v:'GPU 4, Link 1: CRC FLIT Error Count: 0'},
    {t:'good', v:'GPU 4, Link 1: Replay Error Count:   0'},
    {t:'good', v:'GPU 7, Link 3: CRC FLIT Error Count: 0'},
    {t:'good', v:'GPU 7, Link 3: Replay Error Count:   0'},
    {t:'good', v:'All sampled NVLink counters are clean ✓'}
  ],
  benchmark: [
    {t:'cmd',  v:'$ ./nccl-tests/all_reduce_perf -g 8'},
    {t:'dim',  v:'# nThread 1 nGpus 8 minBytes 1073741824 maxBytes 4294967296 step: 2(factor) warmup iters: 5 iters: 20'},
    {t:'dim',  v:'     size         count    type   redop    root      time   algbw   busbw  #wrong'},
    {t:'good', v:'1073741824   268435456   float    sum      -1    11.82 ms  181.7   181.7    0'},
    {t:'good', v:'2147483648   536870912   float    sum      -1    23.45 ms  183.1   183.1    0'},
    {t:'good', v:'4294967296  1073741824   float    sum      -1    46.91 ms  182.7   182.7    0'},
    {t:'good', v:'# Avg bus bandwidth : 182.5 GB/s'}
  ],
  nvlink_fault: [
    {t:'cmd',  v:'$ # Simulating NVLink failure'},
    {t:'warn', v:'# ⚠ Simulating NVLink failure'},
    {t:'dim',  v:'        GPU0  GPU1  GPU2  GPU3  GPU4  GPU5  GPU6  GPU7  CPU Affinity'},
    {t:'err',  v:'GPU0     X    PHB   PHB   PHB   PHB   PHB   PHB   PHB   0-95'},
    {t:'err',  v:'GPU1    PHB    X    PHB   PHB   PHB   PHB   PHB   PHB   0-95'},
    {t:'err',  v:'GPU2    PHB   PHB    X    PHB   PHB   PHB   PHB   PHB   0-95'},
    {t:'err',  v:'GPU3    PHB   PHB   PHB    X    PHB   PHB   PHB   PHB   0-95'},
    {t:'err',  v:'GPU4    PHB   PHB   PHB   PHB    X    PHB   PHB   PHB   96-191'},
    {t:'err',  v:'GPU5    PHB   PHB   PHB   PHB   PHB    X    PHB   PHB   96-191'},
    {t:'err',  v:'GPU6    PHB   PHB   PHB   PHB   PHB   PHB    X    PHB   96-191'},
    {t:'err',  v:'GPU7    PHB   PHB   PHB   PHB   PHB   PHB   PHB    X    96-191'},
    {t:'err',  v:'Actual AllReduce: ~3 GB/s (PCIe host-bridge bottleneck)'}
  ],
  nccl_diag: [
    {t:'cmd',  v:'$ NCCL_DEBUG=INFO torchrun train.py'},
    {t:'warn', v:'NCCL INFO Channel 00/08 : 0[0] -> 1[1] via SHM/direct/direct'},
    {t:'warn', v:'NCCL INFO NET/IB : No device found for requested path, falling back'},
    {t:'err',  v:'NCCL INFO NET/Socket : Using eth0:10.0.0.24<0>'},
    {t:'warn', v:'NCCL INFO Trees [0] -1/-1/-1->7->6'},
    {t:'err',  v:'NCCL INFO Connected all rings using fallback transport'},
    {t:'err',  v:'NCCL WARN Collective bandwidth below expected NVLink baseline'},
    {t:'info', v:'Fix: Physical — inspect NVLink cables and NVSwitch ports on failing GPU pair'},
    {t:'info', v:'Run: nvidia-smi nvlink -e -i 0  (check error counters per link)'},
    {t:'dim',  v:'If counters non-zero: isolate GPU, replace NVLink cable or reseat NVSwitch'}
  ],
  mig_enable: [
    {t:'cmd',  v:'$ sudo nvidia-smi -i 0 -mig 1'},
    {t:'good', v:'Enabled MIG Mode for GPU 00000000:17:00.0'},
    {t:'good', v:'All done.'},
    {t:'dim',  v:''},
    {t:'dim',  v:'GPU  GI  CI  MIG'},
    {t:'good', v:'  0   -   -  Enabled'}
  ],
  mig_create: [
    {t:'cmd',  v:'$ sudo nvidia-smi mig -cgi 9,9,9,9,9,9,9 -C'},
    {t:'good', v:'Successfully created GPU instance ID 1 on GPU 0 using profile MIG 1g.10gb'},
    {t:'good', v:'Successfully created GPU instance ID 2 on GPU 0 using profile MIG 1g.10gb'},
    {t:'good', v:'Successfully created GPU instance ID 3 on GPU 0 using profile MIG 1g.10gb'},
    {t:'good', v:'Successfully created GPU instance ID 4 on GPU 0 using profile MIG 1g.10gb'},
    {t:'good', v:'Successfully created GPU instance ID 5 on GPU 0 using profile MIG 1g.10gb'},
    {t:'good', v:'Successfully created GPU instance ID 6 on GPU 0 using profile MIG 1g.10gb'},
    {t:'good', v:'Successfully created GPU instance ID 7 on GPU 0 using profile MIG 1g.10gb'},
    {t:'dim',  v:'Created layout: 7 x MIG 1g.10gb on GPU 0'}
  ],
  mig_list: [
    {t:'cmd',  v:'$ nvidia-smi mig -lgi'},
    {t:'good', v:'GPU  0  GI 1  CI 0  10GB  MIG 1g.10gb'},
    {t:'good', v:'GPU  0  GI 2  CI 0  10GB  MIG 1g.10gb'},
    {t:'good', v:'GPU  0  GI 3  CI 0  10GB  MIG 1g.10gb'},
    {t:'good', v:'GPU  0  GI 4  CI 0  10GB  MIG 1g.10gb'},
    {t:'good', v:'GPU  0  GI 5  CI 0  10GB  MIG 1g.10gb'},
    {t:'good', v:'GPU  0  GI 6  CI 0  10GB  MIG 1g.10gb'},
    {t:'good', v:'GPU  0  GI 7  CI 0  10GB  MIG 1g.10gb'}
  ],
  mig_assign: [
    {t:'cmd',  v:'$ # Assigning 3 teams'},
    {t:'good', v:'Team A -> GI 1, GI 2'},
    {t:'dim',  v:'  export CUDA_VISIBLE_DEVICES=MIG-GPU-0:1:0,MIG-GPU-0:2:0'},
    {t:'good', v:'Team B -> GI 3, GI 4'},
    {t:'dim',  v:'  export CUDA_VISIBLE_DEVICES=MIG-GPU-0:3:0,MIG-GPU-0:4:0'},
    {t:'good', v:'Team C -> GI 5, GI 6, GI 7'},
    {t:'dim',  v:'  export CUDA_VISIBLE_DEVICES=MIG-GPU-0:5:0,MIG-GPU-0:6:0,MIG-GPU-0:7:0'},
    {t:'good', v:'Isolation boundary: each team stays within assigned MIG instances'}
  ],
  mig_disable: [
    {t:'cmd',  v:'$ sudo nvidia-smi -i 0 -mig 0'},
    {t:'warn', v:'Destroying existing GPU instances before returning to full-device mode'},
    {t:'good', v:'Destroyed GPU instance ID 1 on GPU 0'},
    {t:'good', v:'Destroyed GPU instance ID 2 on GPU 0'},
    {t:'good', v:'Destroyed GPU instance ID 3 on GPU 0'},
    {t:'good', v:'Destroyed GPU instance ID 4 on GPU 0'},
    {t:'good', v:'Destroyed GPU instance ID 5 on GPU 0'},
    {t:'good', v:'Destroyed GPU instance ID 6 on GPU 0'},
    {t:'good', v:'Destroyed GPU instance ID 7 on GPU 0'},
    {t:'good', v:'Disabled MIG Mode for GPU 00000000:17:00.0'},
    {t:'good', v:'All done.'},
    {t:'dim',  v:''},
    {t:'dim',  v:'GPU  GI  CI  MIG'},
    {t:'good', v:'  0   -   -  Disabled'},
    {t:'good', v:'Full GPU restored: H100 SXM5 80GB available as one device'}
  ],
  ecc_healthy: [
    {t:'cmd',  v:'$ dcgmi dmon -e 156,157 -c 5'},
    {t:'dim',  v:'# Entity  GPU  FBECC_SBE_VOL_TOTAL  FBECC_DBE_VOL_TOTAL'},
    {t:'good', v:'0         0    0                    0'},
    {t:'good', v:'1         0    0                    0'},
    {t:'good', v:'2         0    0                    0'},
    {t:'good', v:'3         0    0                    0'},
    {t:'good', v:'4         0    0                    0'}
  ],
  ecc_sbe: [
    {t:'cmd',  v:'$ # Simulating degradation'},
    {t:'warn', v:'# ⚠ Simulating corrected memory-error trend'},
    {t:'dim',  v:'# Entity  GPU  FBECC_SBE_VOL_TOTAL  FBECC_DBE_VOL_TOTAL'},
    {t:'warn', v:'0         0    4                    0'},
    {t:'warn', v:'1         0    7                    0'},
    {t:'warn', v:'2         0    11                   0'},
    {t:'warn', v:'3         0    15                   0'},
    {t:'warn', v:'4         0    19                   0'}
  ],
  ecc_trend: [
    {t:'cmd',  v:'$ dcgmi dmon -e 156,157 -c 10'},
    {t:'dim',  v:'# Entity  GPU  FBECC_SBE_VOL_TOTAL  FBECC_DBE_VOL_TOTAL'},
    {t:'warn', v:'0         0    21                   0'},
    {t:'warn', v:'1         0    25                   0'},
    {t:'warn', v:'2         0    31                   0'},
    {t:'warn', v:'3         0    38                   0'},
    {t:'warn', v:'4         0    46                   0'},
    {t:'warn', v:'5         0    53                   0'},
    {t:'warn', v:'6         0    61                   0'}
  ],
  ecc_xid: [
    {t:'cmd', v:'$ dmesg | grep -i xid'},
    {t:'err', v:'[86423.441] NVRM: Xid (PCI:0000:17:00): 48, pid=42117, name=python3, DBE detected on GPU memory'},
    {t:'err', v:'[86423.442] NVRM: GPU 00000000:17:00.0: Uncorrectable ECC error detected'},
    {t:'err', v:'[86423.447] NVRM: A GPU crash dump has been created'}
  ],
  ecc_drain: [
    {t:'cmd', v:'$ kubectl drain gpu-node-03'},
    {t:'good', v:'node/gpu-node-03 cordoned'},
    {t:'warn', v:'evicting pod training-job-7f9d6c7d8f-2pkhq'},
    {t:'warn', v:'evicting pod inference-batch-42-6dd79b8b9d-r2k4v'},
    {t:'good', v:'node/gpu-node-03 drained'}
  ],
  xid48: [
    {t:'cmd', v:'$ dmesg | tail -20 | grep xid'},
    {t:'err', v:'[92741.102] NVRM: Xid (PCI:0000:17:00): 48, pid=16742, name=python3, DBE detected'},
    {t:'err', v:'[92741.104] NVRM: GPU 00000000:17:00.0: Uncorrectable ECC error reported'},
    {t:'err', v:'[92741.105] NVRM: RmInitAdapter failed during fault handling'}
  ],
  xid48_confirm: [
    {t:'cmd', v:'$ dcgmi dmon -e 157 -c 3'},
    {t:'dim', v:'# Entity  GPU  FBECC_DBE_VOL_TOTAL'},
    {t:'err', v:'0         0    1'},
    {t:'err', v:'1         0    1'},
    {t:'err', v:'2         0    1'}
  ],
  xid79: [
    {t:'cmd', v:'$ # Simulating GPU hang'},
    {t:'err', v:'[93111.772] NVRM: Xid (PCI:0000:65:00): 79, GPU has fallen off the bus'},
    {t:'err', v:'[93111.774] NVRM: GPU 00000000:65:00.0 is no longer responding to commands'},
    {t:'err', v:'[93111.776] NVRM: RmInitAdapter failed! (0x26:0xffff:1290)'}
  ],
  xid79_reset: [
    {t:'cmd', v:'$ sudo nvidia-smi --gpu-reset -i 3'},
    {t:'warn', v:'Resetting GPU 00000000:65:00.0'},
    {t:'err',  v:"GPU Reset couldn't complete because the device is not responding"},
    {t:'warn', v:'Suggested next action: reboot the node before returning GPU to service'}
  ],
  xid74: [
    {t:'cmd', v:'$ nvidia-smi nvlink -e'},
    {t:'err', v:'GPU 2, Link 1: CRC FLIT Error Count: 184'},
    {t:'err', v:'GPU 2, Link 1: Replay Error Count:   27'},
    {t:'err', v:'GPU 5, Link 0: CRC FLIT Error Count: 191'},
    {t:'err', v:'GPU 5, Link 0: Replay Error Count:   29'},
    {t:'err', v:'XID 74 = NVLink link-quality fault evidence'}
  ],
  driver_ver: [
    {t:'cmd', v:'$ cat /proc/driver/nvidia/version'},
    {t:'good', v:'NVRM version: NVIDIA UNIX x86_64 Kernel Module  550.54.15'},
    {t:'dim',  v:'GCC version:  gcc version 11.4.1 20231218 (Red Hat 11.4.1-3)'},
    {t:'dim',  v:'Kernel module build: Tue Mar 19 18:42:11 UTC 2026'}
  ],
  cuda_ver: [
    {t:'cmd', v:'$ nvcc --version'},
    {t:'good', v:'nvcc: NVIDIA (R) Cuda compiler driver'},
    {t:'good', v:'Cuda compilation tools, release 12.4, V12.4.131'},
    {t:'dim',  v:'Build cuda_12.4.r12.4/compiler.34097967_0'}
  ],
  torch_check: [
    {t:'cmd',  v:'>>> import torch'},
    {t:'cmd',  v:'>>> torch.__version__'},
    {t:'good', v:"'2.4.0+cu124'"},
    {t:'cmd',  v:'>>> torch.cuda.is_available()'},
    {t:'good', v:'True'},
    {t:'cmd',  v:'>>> torch.cuda.get_device_name(0)'},
    {t:'good', v:"'NVIDIA H100 80GB HBM3'"}
  ],
  cuda_mismatch: [
    {t:'cmd',  v:'$ # Simulating version mismatch'},
    {t:'err',  v:'RuntimeError: CUDA driver version is insufficient for CUDA runtime version'},
    {t:'err',  v:'PyTorch built against CUDA 12.4, detected runtime support is incompatible'},
    {t:'warn', v:'Suggested action: use a validated container image or align driver/CUDA/framework versions'}
  ],
  ngc_fix: [
    {t:'cmd',  v:'$ docker pull nvcr.io/nvidia/pytorch'},
    {t:'dim',  v:'Using default tag: 24.03-py3'},
    {t:'good', v:'24.03-py3: Pulling from nvidia/pytorch'},
    {t:'good', v:'Digest: sha256:3df6d5b7c8b1e81f2e66f4a31d2b4b2b6f0d0f4f9a6b7e9f8d2a7a4c5e3c9b1a'},
    {t:'good', v:'Status: Downloaded newer image for nvcr.io/nvidia/pytorch:24.03-py3'}
  ],
  ngc_pull: [
    {t:'cmd',  v:'$ docker pull nvcr.io/nvidia/pytorch'},
    {t:'dim',  v:'Using default tag: 24.03-py3'},
    {t:'good', v:'24.03-py3: Pulling from nvidia/pytorch'},
    {t:'good', v:'Digest: sha256:3df6d5b7c8b1e81f2e66f4a31d2b4b2b6f0d0f4f9a6b7e9f8d2a7a4c5e3c9b1a'},
    {t:'good', v:'Status: Image is up to date for nvcr.io/nvidia/pytorch:24.03-py3'}
  ],
  ngc_run: [
    {t:'cmd',  v:'$ docker run --rm --gpus all nvcr.io/nvidia/pytorch:24.03-py3 nvidia-smi -L'},
    {t:'good', v:'GPU 0: NVIDIA H100 80GB HBM3 (UUID: GPU-3b1f3d52-2b2f-4f0d-8c1c-6e0f9a1f4b6d)'},
    {t:'good', v:'GPU 1: NVIDIA H100 80GB HBM3 (UUID: GPU-7c2e1baf-8d3f-4a4d-a8ae-67d7e88232ef)'},
    {t:'dim',  v:'... GPUs 2-7 visible inside container'}
  ],
  ngc_verify: [
    {t:'cmd',  v:'>>> import torch'},
    {t:'cmd',  v:'>>> torch.cuda.is_available()'},
    {t:'good', v:'True'},
    {t:'cmd',  v:'>>> torch.cuda.device_count()'},
    {t:'good', v:'8'}
  ],
  ngc_train: [
    {t:'cmd',  v:'$ docker run --gpus all python3 train.py'},
    {t:'info', v:'Epoch 0 | step 1/100 | loss 6.21 | throughput 1820 samples/s'},
    {t:'info', v:'Epoch 0 | step 2/100 | loss 6.05 | throughput 1834 samples/s'},
    {t:'info', v:'Epoch 0 | step 3/100 | loss 5.94 | throughput 1827 samples/s'}
  ],
  ngc_monitor: [
    {t:'cmd',  v:'$ docker exec nvidia-smi dmon'},
    {t:'dim',  v:'# gpu   sm   mem   enc   dec   mclk   pclk   pwr'},
    {t:'good', v:'0      96   71    0     0     1593   1980   648'},
    {t:'good', v:'1      95   69    0     0     1593   1980   644'}
  ],
  ddp_launch: [
    {t:'cmd', v:'$ torchrun train.py'},
    {t:'good', v:'RANK 0/8 initialized | MASTER_ADDR=10.1.10.177 MASTER_PORT=29500'},
    {t:'good', v:'RANK 1/8 initialized | backend=nccl'},
    {t:'good', v:'RANK 7/8 initialized | backend=nccl'},
    {t:'good', v:'World size 8 established successfully'}
  ],
  ddp_fwd: [
    {t:'cmd', v:'$ # Sharding batch'},
    {t:'info', v:'rank0 | batch shard 0/8 | forward 42.1 ms'},
    {t:'info', v:'rank1 | batch shard 1/8 | forward 41.7 ms'},
    {t:'info', v:'rank7 | batch shard 7/8 | forward 42.4 ms'}
  ],
  ddp_bwd: [
    {t:'cmd', v:'$ # Computing local grads'},
    {t:'info', v:'rank0 | backward complete | grad buckets ready'},
    {t:'info', v:'rank1 | backward complete | grad buckets ready'},
    {t:'info', v:'rank7 | backward complete | grad buckets ready'}
  ],
  ddp_allreduce: [
    {t:'cmd', v:'$ # Averaging grads'},
    {t:'good', v:'bucket 0 allreduce complete | 6.8 ms'},
    {t:'good', v:'bucket 1 allreduce complete | 7.1 ms'},
    {t:'good', v:'bucket 2 allreduce complete | 6.9 ms'},
    {t:'good', v:'iteration sync overhead | 8.4%'}
  ],
  ddp_update: [
    {t:'cmd', v:'$ optimizer.step()'},
    {t:'good', v:'optimizer.step() applied on rank0'},
    {t:'good', v:'optimizer.step() applied on rank1'},
    {t:'good', v:'global step 184 complete | loss 4.82'}
  ],
  ddp_storage: [
    {t:'cmd',  v:'$ iostat -x 1'},
    {t:'dim',  v:'Device            r/s   rkB/s  await  %util'},
    {t:'err',  v:'nfs0            1821  944128   47.9  100.0'},
    {t:'warn', v:'gpu ranks waiting on next batch'},
    {t:'err',  v:'iteration time expanded from 420 ms to 1180 ms'}
  ],
  nccl_path: [
    {t:'cmd', v:'$ NCCL_DEBUG=INFO torchrun train.py'},
    {t:'good', v:'NCCL INFO NET/IB : Using mlx5_0 port 1'},
    {t:'good', v:'NCCL INFO Using network IB for inter-node collectives'},
    {t:'good', v:'NCCL INFO Connected all rings using IB transport'}
  ],
  ring1: [
    {t:'cmd', v:'$ # Step 1/8'},
    {t:'info', v:'rank0 -> rank1 | chunk 0 reduced'},
    {t:'info', v:'rank1 -> rank2 | chunk 1 reduced'},
    {t:'info', v:'rank7 -> rank0 | chunk 7 reduced'}
  ],
  ring2: [
    {t:'cmd', v:'$ # Step 8/8'},
    {t:'good', v:'rank0 received final reduced chunk'},
    {t:'good', v:'rank3 received final reduced chunk'},
    {t:'good', v:'rank7 received final reduced chunk'}
  ],
  ar_bench: [
    {t:'cmd', v:'$ ./all_reduce_perf'},
    {t:'good', v:'size 1073741824 | algbw 181.2 GB/s | busbw 181.2 GB/s'},
    {t:'good', v:'size 2147483648 | algbw 182.8 GB/s | busbw 182.8 GB/s'},
    {t:'good', v:'# Avg bus bandwidth : 182.0 GB/s'}
  ],
  ar_fault: [
    {t:'cmd', v:'$ export NCCL_IB_DISABLE=1'},
    {t:'warn', v:'NCCL INFO NCCL_IB_DISABLE set by environment'},
    {t:'err',  v:'NCCL INFO NET/Socket : Using eth0:10.1.10.177<0>'},
    {t:'err',  v:'NCCL WARN Falling back from IB to socket transport'}
  ],
  ar_fix: [
    {t:'cmd', v:'$ unset NCCL_IB_DISABLE'},
    {t:'good', v:'NCCL INFO NET/IB : Using mlx5_0 port 1'},
    {t:'good', v:'NCCL INFO Connected all rings using IB transport'},
    {t:'good', v:'Benchmark recovered to expected bandwidth envelope'}
  ],
  ib_stat: [
    {t:'cmd',  v:'$ ibstat'},
    {t:'good', v:"CA 'mlx5_0'"},
    {t:'good', v:'  Port 1: State: Active'},
    {t:'good', v:'  Physical state: LinkUp'},
    {t:'good', v:'  Rate: 400 Gb/sec (4X NDR)'},
    {t:'dim',  v:'  Base lid: 12 | SM lid: 1 | Link layer: InfiniBand'}
  ],
  ib_perfq: [
    {t:'cmd',  v:'$ perfquery'},
    {t:'good', v:'SymbolErrorCounter.............0'},
    {t:'good', v:'LinkErrorRecoveryCounter.......0'},
    {t:'good', v:'PortRcvErrors..................0'},
    {t:'good', v:'PortXmitDiscards...............0'},
    {t:'good', v:'VL15Dropped....................0'}
  ],
  ib_bw: [
    {t:'cmd',  v:'$ ib_write_bw -d mlx5_0'},
    {t:'dim',  v:'#bytes     #iterations    BW peak[Gb/sec]    BW average[Gb/sec]'},
    {t:'good', v:'65536      1000           378.40             377.90'},
    {t:'good', v:'131072     1000           379.10             378.50'},
    {t:'good', v:'262144     1000           380.02             379.31'},
    {t:'good', v:'BW steady within healthy NDR envelope'}
  ],
  ib_fault: [
    {t:'cmd',  v:'$ ibstat'},
    {t:'err',  v:"CA 'mlx5_0'"},
    {t:'err',  v:'  Port 1: State: Down'},
    {t:'err',  v:'  Physical state: Polling'},
    {t:'err',  v:'  Rate: 0 Gb/sec'},
    {t:'warn', v:'Fast fabric path unavailable for node-06'}
  ],
  ib_diag: [
    {t:'cmd',  v:'$ ibdiagnet --pc'},
    {t:'err',  v:'ibdiagnet: bad cable or signal quality detected'},
    {t:'err',  v:'node-06 / mlx5_0 / port 1 -> switch-a / port 12'},
    {t:'err',  v:'Port counters inconsistent with healthy baseline'},
    {t:'warn', v:'Recommendation: isolate link and replace cable before reopening path'}
  ],
  ib_sweep: [
    {t:'cmd',  v:'$ ibdiagnet --pc --pm'},
    {t:'good', v:'Sweep summary: 95 healthy ports, 1 unhealthy path'},
    {t:'warn', v:'Impacted path: node-06 <-> switch-a port 12'},
    {t:'good', v:'No wider switch-wide congestion signature detected'},
    {t:'good', v:'Blast radius: single endpoint pair'}
  ],
  roce_mtu: [
    {t:'cmd',  v:'$ ip link show eth0'},
    {t:'good', v:'2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9000 qdisc mq state UP mode DEFAULT group default qlen 1000'},
    {t:'dim',  v:'    link/ether 00:1a:4b:16:01:77 brd ff:ff:ff:ff:ff:ff'},
    {t:'good', v:'Host MTU matches jumbo-frame RoCE design'}
  ],
  roce_pfc: [
    {t:'cmd',  v:'$ ethtool -A eth0'},
    {t:'dim',  v:'Pause parameters for eth0:'},
    {t:'good', v:'Autonegotiate: off'},
    {t:'good', v:'RX: on'},
    {t:'good', v:'TX: on'},
    {t:'good', v:'PFC/lossless policy enabled for RDMA traffic'}
  ],
  roce_ecn: [
    {t:'cmd',  v:'$ tc qdisc show dev eth0'},
    {t:'good', v:'qdisc mq 0: dev eth0 root'},
    {t:'good', v:'qdisc fq_codel 8010: dev eth0 parent :1 limit 10240 ecn'},
    {t:'good', v:'qdisc fq_codel 8011: dev eth0 parent :2 limit 10240 ecn'},
    {t:'good', v:'ECN marking available before pause-heavy collapse'}
  ],
  roce_bw: [
    {t:'cmd',  v:'$ ib_write_bw --report_gbits -d rxe0'},
    {t:'dim',  v:'#bytes     #iterations    BW peak[Gb/sec]    BW average[Gb/sec]'},
    {t:'good', v:'65536      1000           184.20             183.60'},
    {t:'good', v:'131072     1000           185.10             184.40'},
    {t:'good', v:'Bandwidth stable within expected RoCE envelope'}
  ],
  roce_fault: [
    {t:'cmd',  v:'$ ethtool -S eth0'},
    {t:'err',  v:'tx_prio3_pause: 48291'},
    {t:'err',  v:'rx_prio3_pause: 51744'},
    {t:'err',  v:'pfc_storm_warning: threshold exceeded'},
    {t:'warn', v:'Link remains up, but congestion control is now the failure signal'}
  ],
  roce_fix: [
    {t:'cmd',  v:'$ apply ecn threshold 48kb'},
    {t:'good', v:'Updated switch buffer profile for RoCE priority class 3'},
    {t:'good', v:'Applied ECN threshold 48KB / 96KB'},
    {t:'good', v:'Reduced pause storm behavior on validation run'},
    {t:'good', v:'rx_prio3_pause stabilized below alert threshold'}
  ],
  fb_diag: [
    {t:'cmd',  v:'$ NCCL_DEBUG=INFO torchrun train.py'},
    {t:'err',  v:'NCCL INFO NET/Socket : Using eth0:10.1.10.177<0>'},
    {t:'err',  v:'NCCL INFO NET/IB : No device selected'},
    {t:'warn', v:'NCCL WARN Falling back to TCP transport'},
    {t:'warn', v:'Job launched, but communication path is degraded'}
  ],
  fb_env: [
    {t:'cmd',  v:'$ env | grep NCCL'},
    {t:'err',  v:'NCCL_IB_DISABLE=1'},
    {t:'dim',  v:'NCCL_DEBUG=INFO'},
    {t:'warn', v:'Environment is forcing the wrong transport path'}
  ],
  fb_ib: [
    {t:'cmd',  v:'$ ibstat'},
    {t:'good', v:"CA 'mlx5_0'"},
    {t:'good', v:'  Port 1: State: Active'},
    {t:'good', v:'  Physical state: LinkUp'},
    {t:'good', v:'  Rate: 400 Gb/sec (4X NDR)'},
    {t:'good', v:'Fast transport is available despite NCCL fallback'}
  ],
  fb_fix: [
    {t:'cmd',  v:'$ export NCCL_IB_HCA=mlx5_0'},
    {t:'good', v:'export NCCL_IB_HCA=mlx5_0'},
    {t:'good', v:'unset NCCL_IB_DISABLE'},
    {t:'good', v:'Ready to re-run NCCL path selection'}
  ],
  fb_verify: [
    {t:'cmd',  v:'$ NCCL_DEBUG=INFO torchrun'},
    {t:'good', v:'NCCL INFO NET/IB : Using mlx5_0 port 1'},
    {t:'good', v:'NCCL INFO Connected all rings using IB transport'},
    {t:'good', v:'NCCL INFO Socket fallback no longer selected'}
  ],
  fb_bench: [
    {t:'cmd',  v:'$ ./all_reduce_perf -g 16'},
    {t:'err',  v:'before fix : 8.1 GB/s'},
    {t:'good', v:'after fix  : 181.9 GB/s'},
    {t:'good', v:'communication path restored to expected baseline'},
    {t:'good', v:'Observed improvement: 22.5x'}
  ],
  stor_gpu: [
    {t:'cmd',  v:'$ nvidia-smi dmon -s u'},
    {t:'dim',  v:'# gpu    sm'},
    {t:'err',  v:'0        92'},
    {t:'err',  v:'0        11'},
    {t:'err',  v:'0        89'},
    {t:'err',  v:'0        14'},
    {t:'warn', v:'Sawtooth GPU utilization: accelerators are waiting for input'}
  ],
  stor_io: [
    {t:'cmd',  v:'$ iostat -x 1'},
    {t:'dim',  v:'Device            r/s   rkB/s  await  %util'},
    {t:'err',  v:'nvme0n1         1820  941824   34.1  100.0'},
    {t:'err',  v:'nvme1n1         1774  915332   32.8   99.7'},
    {t:'warn', v:'Storage pressure matches the GPU starvation pattern'}
  ],
  stor_lustre: [
    {t:'cmd',  v:'$ lfs getstripe /datasets/train'},
    {t:'err',  v:'stripe_count: 1'},
    {t:'dim',  v:'stripe_size: 1048576'},
    {t:'dim',  v:'obdidx: 12'},
    {t:'warn', v:'Dataset layout is too narrow for parallel training reads'}
  ],
  stor_fix: [
    {t:'cmd',  v:'$ lfs setstripe -c 8 /datasets/train'},
    {t:'good', v:'Applied stripe_count: 8'},
    {t:'good', v:'Applied stripe_size: 1048576'},
    {t:'good', v:'Dataset now spread across 8 OSTs'}
  ],
  stor_dl: [
    {t:'cmd',  v:'$ set dataloader workers 16'},
    {t:'good', v:'DataLoader(num_workers=16, prefetch_factor=4)'},
    {t:'good', v:'worker startup complete'},
    {t:'good', v:'input queue depth stable above threshold'}
  ],
  stor_verify: [
    {t:'cmd',  v:'$ nvidia-smi dmon'},
    {t:'dim',  v:'# gpu    sm'},
    {t:'good', v:'0        93'},
    {t:'good', v:'0        95'},
    {t:'good', v:'0        94'},
    {t:'good', v:'0        96'},
    {t:'good', v:'Sawtooth cleared; GPUs are being fed steadily'}
  ],
  gds_old: [
    {t:'cmd',  v:'$ cat /opt/aegis/gds-path.txt'},
    {t:'warn', v:'NVMe read -> page cache / CPU memory'},
    {t:'warn', v:'CPU copies batch into pinned buffer'},
    {t:'warn', v:'CUDA transfer -> GPU memory'},
    {t:'dim',  v:'Traditional path includes CPU-mediated handoff'}
  ],
  gds_new: [
    {t:'cmd',  v:'$ cat /opt/aegis/gds-direct-path.txt'},
    {t:'good', v:'NVMe read -> cuFile / DMA engine'},
    {t:'good', v:'direct transfer -> GPU memory'},
    {t:'good', v:'reduced CPU copy involvement'}
  ],
  gds_verify: [
    {t:'cmd',  v:'>>> import cufile'},
    {t:'cmd',  v:'>>> cufile.__version__'},
    {t:'good', v:"'1.9.0'"},
    {t:'good', v:'cuFile runtime available for GDS'}
  ],
  gds_bench_old: [
    {t:'cmd',  v:'$ python3 /opt/aegis/gds_bench.py --mode=traditional'},
    {t:'warn', v:'traditional path throughput : 890 MB/s'},
    {t:'warn', v:'CPU utilization elevated during copy path'}
  ],
  gds_bench_new: [
    {t:'cmd',  v:'$ python3 /opt/aegis/gds_bench.py --mode=gds'},
    {t:'good', v:'traditional path : 0.89 GB/s'},
    {t:'good', v:'GDS path         : 2.4 GB/s'},
    {t:'good', v:'observed gain    : 2.7x'}
  ],
  mon_deploy: [
    {t:'cmd',  v:'$ docker run dcgm-exporter'},
    {t:'good', v:'dcgm-exporter listening on :9400'},
    {t:'good', v:'collecting NVIDIA GPU metrics'},
    {t:'good', v:'exporter startup complete'}
  ],
  mon_verify: [
    {t:'cmd',  v:'$ curl localhost:9400/metrics'},
    {t:'dim',  v:'# HELP DCGM_FI_DEV_GPU_TEMP GPU temperature'},
    {t:'good', v:'DCGM_FI_DEV_GPU_TEMP{gpu="0"} 39'},
    {t:'good', v:'DCGM_FI_DEV_POWER_USAGE{gpu="0"} 287'},
    {t:'good', v:'DCGM_FI_DEV_GPU_UTIL{gpu="0"} 82'}
  ],
  mon_prom: [
    {t:'cmd',  v:'$ curl http://prometheus:9090/api/v1/targets'},
    {t:'good', v:'Target: dcgm-exporter:9400'},
    {t:'good', v:'State: UP'},
    {t:'good', v:'Last scrape: 4.1s ago'},
    {t:'dim',  v:'Scrape duration: 0.118s'}
  ],
  mon_grafana: [
    {t:'cmd',  v:'$ grafana-cli dashboards import 12239'},
    {t:'good', v:'Dashboard 12239 imported'},
    {t:'good', v:'Panel: GPU Utilization'},
    {t:'good', v:'Panel: Temperature / Power'},
    {t:'good', v:'Panel: ECC Errors'},
    {t:'good', v:'Panel: NVLink / PCIe health'}
  ],
  mon_alert: [
    {t:'cmd',  v:'$ promtool check rules gpu-alerts.yml'},
    {t:'good', v:'alert: GPU_DBE_Detected'},
    {t:'good', v:'expr: DCGM_FI_DEV_ECC_DBE_VOL_TOTAL > 0'},
    {t:'good', v:'for: 1m'},
    {t:'good', v:'labels: severity=critical'}
  ],
  mon_test: [
    {t:'cmd',  v:'$ simulate dbe'},
    {t:'err',  v:'ALERTS{alertname="GPU_DBE_Detected",severity="critical"} 1'},
    {t:'err',  v:'Alertmanager notification sent to ops-gpu channel'},
    {t:'good', v:'Test incident acknowledged'}
  ],
  slurm_submit: [
    {t:'cmd',  v:'$ sbatch train.sh'},
    {t:'good', v:'Submitted batch job 99234'},
    {t:'dim',  v:'Job 99234 is now under Slurm scheduling control'}
  ],
  slurm_queue: [
    {t:'cmd',  v:'$ squeue -u alice'},
    {t:'dim',  v:'JOBID   PARTITION   NAME    USER   ST     TIME   NODES   NODELIST(REASON)'},
    {t:'warn', v:'99234   gpu         train   alice  PD     0:00   2       (Priority)'},
    {t:'info', v:'State PD means pending, not failed'}
  ],
  slurm_pend: [
    {t:'cmd',  v:'$ scontrol show job 99234'},
    {t:'warn', v:'JobId=99234 JobState=PENDING Reason=Priority'},
    {t:'dim',  v:'ReqNodes=2 ReqGRES=gpu:8'},
    {t:'dim',  v:'EligibleTime=2026-04-21T17:11:04'},
    {t:'info', v:'Scheduler reason is policy priority, not node failure'}
  ],
  slurm_fair: [
    {t:'cmd',  v:'$ sshare -u alice'},
    {t:'dim',  v:'User   Account   RawShares   NormShares   RawUsage   FairShare'},
    {t:'warn', v:'alice  research  1           0.125        91324      0.034'},
    {t:'info', v:'Low FairShare explains why this user has reduced priority'}
  ],
  slurm_drain: [
    {t:'cmd',  v:'$ scontrol update NodeName=gpu-node-05 State=DRAIN Reason="Investigating GPU interconnect health"'},
    {t:'warn', v:'NodeName=gpu-node-05 State=DRAIN'},
    {t:'warn', v:'Reason=Investigating GPU interconnect health'},
    {t:'good', v:'New placements blocked while diagnosis continues'}
  ],
  slurm_resume: [
    {t:'cmd',  v:'$ scontrol update NodeName=gpu-node-05 State=RESUME'},
    {t:'good', v:'NodeName=gpu-node-05 State=IDLE'},
    {t:'good', v:'Resume acknowledged by scheduler'},
    {t:'good', v:'Node returned to scheduling pool after validation'}
  ],
  k8s_operator: [
    {t:'cmd',  v:'$ kubectl get pods -n gpu-operator'},
    {t:'good', v:'nvidia-device-plugin-daemonset   1/1   Running'},
    {t:'good', v:'gpu-feature-discovery            1/1   Running'},
    {t:'good', v:'nvidia-operator-validator        1/1   Completed'},
    {t:'good', v:'GPU operator enablement layer is healthy'}
  ],
  k8s_resources: [
    {t:'cmd',  v:'$ kubectl describe node gpu-node-01'},
    {t:'dim',  v:'Capacity:'},
    {t:'good', v:'  nvidia.com/gpu: 8'},
    {t:'dim',  v:'Allocatable:'},
    {t:'good', v:'  nvidia.com/gpu: 8'},
    {t:'good', v:'Scheduler-visible GPU capacity matches node design'}
  ],
  k8s_pending: [
    {t:'cmd',  v:'$ kubectl describe pod training-pod'},
    {t:'dim',  v:'Events:'},
    {t:'err',  v:'  Warning  FailedScheduling  2m   default-scheduler'},
    {t:'err',  v:'  0/4 nodes are available: 4 Insufficient nvidia.com/gpu.'},
    {t:'warn', v:'Pending reason is resource capacity, not container startup'}
  ],
  k8s_netpol: [
    {t:'cmd',  v:'$ kubectl get netpol'},
    {t:'dim',  v:'NAME                   POD-SELECTOR      AGE'},
    {t:'err',  v:'deny-cross-namespace   app=trainer       3d'},
    {t:'warn', v:'allow-metrics-only     app=gpu-exporter  3d'},
    {t:'warn', v:'Policy layer may block required training communication'}
  ],
  k8s_drain: [
    {t:'cmd',  v:'$ kubectl drain gpu-node-03'},
    {t:'good', v:'node/gpu-node-03 cordoned'},
    {t:'warn', v:'evicting pod trainer-7f9d6c7d8f-abc12'},
    {t:'warn', v:'evicting pod inference-batch-42-6dd79b8b9d-r2k4v'},
    {t:'good', v:'node/gpu-node-03 drained'}
  ],
  k8s_gang: [
    {t:'cmd',  v:'$ kubectl get podgroup'},
    {t:'dim',  v:'NAME            MIN MEMBER  RUNNING  SCHEDULED'},
    {t:'good', v:'training-gang   16          16       True'},
    {t:'good', v:'Distributed workload placed as one coordinated group'}
  ]
};

const DMESG_CLEAN = [
  {t:'dim',  v:'[    0.000] Linux version 5.14.0-427.16.1.el9_4.x86_64 (gcc version 11.4.1 20231218)'},
  {t:'dim',  v:'[    0.441] pci 0000:03:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'dim',  v:'[    0.441] pci 0000:13:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'dim',  v:'[    0.441] pci 0000:23:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'dim',  v:'[    0.441] pci 0000:33:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'dim',  v:'[    0.441] pci 0000:43:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'dim',  v:'[    0.441] pci 0000:53:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'dim',  v:'[    0.441] pci 0000:63:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'dim',  v:'[    0.441] pci 0000:73:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'good', v:'[    0.502] nvidia 0000:03:00.0: enabling device (0000 -> 0002)'},
  {t:'good', v:'[    0.521] nvidia 0000:13:00.0: enabling device (0000 -> 0002)'},
  {t:'good', v:'[    0.539] nvidia 0000:23:00.0: enabling device (0000 -> 0002)'},
  {t:'good', v:'[    0.557] nvidia 0000:33:00.0: enabling device (0000 -> 0002)'},
  {t:'good', v:'[    0.575] nvidia 0000:43:00.0: enabling device (0000 -> 0002)'},
  {t:'good', v:'[    0.593] nvidia 0000:53:00.0: enabling device (0000 -> 0002)'},
  {t:'good', v:'[    0.611] nvidia 0000:63:00.0: enabling device (0000 -> 0002)'},
  {t:'good', v:'[    0.629] nvidia 0000:73:00.0: enabling device (0000 -> 0002)'},
  {t:'info', v:'[    4.101] NVRM: loading NVIDIA UNIX x86_64 Kernel Module  550.54.15  Tue Mar 19 18:42:11 UTC 2026'},
  {t:'info', v:'[    4.204] nvidia-nvswitch: detected 4 NVSwitches (LS10)'},
  {t:'good', v:'[    4.318] nvidia-nvlink: NvLink 4.0 Connected — 900 GB/s bidirectional per link  ✓'},
  {t:'good', v:'[    4.502] nvidia-nvswitch: all 8 GPUs fully meshed via NVSwitch fabric  ✓'},
  {t:'info', v:'[    5.012] nvidia-modeset: Loading NVIDIA Kernel Mode Setting Driver for UNIX platforms 550.54.15'},
  {t:'dim',  v:'[    5.234] NVRM: GPU Board Serial Number: [N/A]'},
  {t:'good', v:'[   12.441] nvidia 0000:03:00.0: irq 151 for MSI/MSI-X  ✓'},
  {t:'good', v:'[   12.458] nvidia 0000:13:00.0: irq 167 for MSI/MSI-X  ✓'},
  {t:'good', v:'[   12.475] nvidia 0000:23:00.0: irq 183 for MSI/MSI-X  ✓'},
  {t:'good', v:'[   15.001] nvidia-peermem: module loaded, version 1.4'},
  {t:'good', v:'[   15.441] nvidia-fs: nvidia_fs init successful, version=2.17.0 (GPUDirect Storage ready)  ✓'},
  {t:'good', v:'[   16.020] mlx5_core 0000:c1:00.0: firmware version 28.39.1002 (ConnectX-7 NDR400)'},
  {t:'good', v:'[   16.088] mlx5_core 0000:c1:00.1: firmware version 28.39.1002 (ConnectX-7 NDR400)'}
];

const DCGM_CLEAN = [
  {t:'dim',  v:'# dcgmi dmon -e 100,101,110,140,155,156,157,206 -d 1000'},
  {t:'dim',  v:'#           Utiliz  MemUtil  FBUsed   Temp   Power   SBE     DBE     XID'},
  {t:'dim',  v:'#Entity     (%)     (%)      (MiB)    (°C)   (W)     (cnt)   (cnt)   (cnt)'},
  {t:'good', v:' GPU 0       82      68       43622    71     418     0       0       0'},
  {t:'good', v:' GPU 1       79      65       42187    69     411     0       0       0'},
  {t:'good', v:' GPU 2       85      71       45056    73     432     0       0       0'},
  {t:'good', v:' GPU 3       81      67       43008    70     421     0       0       0'},
  {t:'good', v:' GPU 4       83      69       44032    72     425     0       0       0'},
  {t:'good', v:' GPU 5       80      66       42496    70     415     0       0       0'},
  {t:'good', v:' GPU 6       84      70       44544    71     428     0       0       0'},
  {t:'good', v:' GPU 7       82      68       43520    71     419     0       0       0'},
  {t:'dim',  v:''},
  {t:'dim',  v:'# dcgmi health -g 0 --check'},
  {t:'good', v:'Overall Health: Healthy'},
  {t:'good', v:'  GPU 0 : Healthy  |  GPU 1 : Healthy  |  GPU 2 : Healthy  |  GPU 3 : Healthy'},
  {t:'good', v:'  GPU 4 : Healthy  |  GPU 5 : Healthy  |  GPU 6 : Healthy  |  GPU 7 : Healthy'},
  {t:'dim',  v:''},
  {t:'dim',  v:'# dcgmi nvlink --link-status -g 0'},
  {t:'good', v:'  GPU 0 - Link  0: Active  bw=900 GB/s  ✓   CRC Errs: 0   Replay: 0'},
  {t:'good', v:'  GPU 0 - Link  1: Active  bw=900 GB/s  ✓   CRC Errs: 0   Replay: 0'},
  {t:'good', v:'  GPU 1 - Link  0: Active  bw=900 GB/s  ✓   CRC Errs: 0   Replay: 0'},
  {t:'good', v:'  GPU 2 - Link  0: Active  bw=900 GB/s  ✓   CRC Errs: 0   Replay: 0'}
];
