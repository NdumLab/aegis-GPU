/**
 * HARDWARE MODULE: Blueprints & Sentinel Logic
 */

const HARDWARE_LIBRARY = {
    H100_HGX: { name: "HGX H100", nodes: 8, vram: 80, powerPerGpu: 700, fabricDefault: "IB_NDR", labelPrefix: "Node" },
    A100_HGX: { name: "HGX A100", nodes: 8, vram: 80, powerPerGpu: 400, fabricDefault: "IB_HDR", labelPrefix: "Node" },
    L40S_OVX: { name: "OVX L40S", nodes: 4, vram: 48, powerPerGpu: 350, fabricDefault: "ETH_RoCE", labelPrefix: "Node" },
    GB200_NVL72: { name: "GB200 NVL72", nodes: 18, vram: 192, powerPerGpu: 1200, fabricDefault: "IB_NDR", labelPrefix: "Tray" }
};

function validateHardwareConfig(blueprintKey, fabricKey) {
    if (blueprintKey === 'L40S_OVX' && fabricKey.includes('IB')) {
        return { isMatch: false, reason: "L40S OVX systems rely on Ethernet (RoCEv2). They typically do not support InfiniBand out of the box." };
    }
    if (blueprintKey === 'GB200_NVL72' && fabricKey === 'ETH_RoCE') {
        return { isMatch: false, reason: "GB200 NVL72 rack-scale systems require Quantum InfiniBand or Spectrum-X800 Ethernet for scale-out. Standard RoCEv2 is a severe bottleneck." };
    }
    return { isMatch: true, reason: "Valid configuration." };
}
