/**
 * RENDER MODULE: Visualization Engine
 * Handles all SVG drawing, animations, and the Digital Twin Rack Elevation.
 */
let animFrames = []; // Tracks active animations for cleanup
let animIntervals = []; // Tracks setInterval IDs for cleanup
let animTimeouts = [];

// ════════════════════════════════════════════════════════════════════
// CORE SVG UTILITIES
// ════════════════════════════════════════════════════════════════════
function clearCanvas() {
  const svg = document.getElementById('diagram-canvas');
  while(animFrames.length){ cancelAnimationFrame(animFrames.pop()); }
  while(animIntervals.length){ clearInterval(animIntervals.pop()); }
  while(animTimeouts.length) clearTimeout(animTimeouts.pop());
  svg.innerHTML = '';
  return svg;
}

function svgEl(tag, attrs={}, text='') {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
  if(text) el.textContent = text;
  return el;
}

function node(svg, x, y, w, h, fill, stroke, labelText, sub='', labelColor='#e8eef8') {
  const g = svgEl('g');
  g.setAttribute('class','node-box');
  const rect = svgEl('rect', {x,y,width:w,height:h,rx:4,fill,stroke,'stroke-width':'1.5'});
  g.appendChild(rect);
  const lbl = svgEl('text',{x:x+w/2,y:y+h/2+(sub?-7:4),'text-anchor':'middle',fill:labelColor,'font-family':'JetBrains Mono, monospace','font-size':'12','font-weight':'600'}, labelText);
  g.appendChild(lbl);
  if(sub){
    const sub2 = svgEl('text',{x:x+w/2,y:y+h/2+10,'text-anchor':'middle',fill:'#5a6a85','font-family':'JetBrains Mono, monospace','font-size':'9'}, sub);
    g.appendChild(sub2);
  }
  svg.appendChild(g);
  return g;
}

function label(svg, x, y, text, color='#5a6a85', size=10, anchor='middle', weight='400') {
  const el = svgEl('text',{x,y,'text-anchor':anchor,fill:color,'font-family':'DM Sans, sans-serif','font-size':size,'font-weight':weight}, text);
  svg.appendChild(el);
  return el;
}

function line(svg, x1,y1,x2,y2,color='#2a3347',width=1.5,dash='') {
  const el = svgEl('line',{x1,y1,x2,y2,stroke:color,'stroke-width':width,'stroke-dasharray':dash});
  svg.appendChild(el);
  return el;
}

function arrow(svg, x1,y1,x2,y2,color='#4a9eff',label_='',animated=false) {
  const id = 'arr-' + Math.random().toString(36).slice(2,6);
  const defs = svgEl('defs');
  const marker = svgEl('marker',{id,markerWidth:'8',markerHeight:'8',refX:'6',refY:'3',orient:'auto'});
  const poly = svgEl('polygon',{points:'0 0, 8 3, 0 6',fill:color});
  marker.appendChild(poly);
  defs.appendChild(marker);
  svg.appendChild(defs);
  const path = svgEl('line',{x1,y1,x2,y2,stroke:color,'stroke-width':'1.5','marker-end':`url(#${id})`});
  if(animated){
    path.style.strokeDasharray = '6 4';
    path.style.animation = 'flow-dash 1.5s linear infinite';
  }
  svg.appendChild(path);
  if(label_) {
    const mx=(x1+x2)/2, my=(y1+y2)/2-6;
    const lbl = svgEl('text',{x:mx,y:my,'text-anchor':'middle',fill:color,'font-family':'JetBrains Mono, monospace','font-size':'9'}, label_);
    svg.appendChild(lbl);
  }
  return path;
}

function packet(svg, x, y, color='#76b900', size=8) {
  const el = svgEl('rect',{x:x-size/2,y:y-size/2,width:size,height:size,rx:2,fill:color,'opacity':'0.9'});
  svg.appendChild(el);
  return el;
}

function animPackets(svg, path_coords, color='#76b900', count=3, speed=2000) {
  const pkts = [];
  path_coords.forEach(([sx,sy,ex,ey], pi) => {
    for(let i=0;i<count;i++){
      const delay = (pi*200 + i*(speed/count));
      animTimeouts.push(setTimeout(()=>{
        const pkt = packet(svg, sx, sy, color);
        pkts.push(pkt);
        const start = performance.now();
        function frame(now) {
          const t = Math.min((now-start)/speed,1);
          const cx = sx + (ex-sx)*t;
          const cy = sy + (ey-sy)*t;
          pkt.setAttribute('x', cx-4);
          pkt.setAttribute('y', cy-4);
          if(t<1) {
            const af = requestAnimationFrame(frame);
            animFrames.push(af);
          } else {
            pkt.setAttribute('opacity','0');
            animTimeouts.push(setTimeout(()=>pkt.remove(),100));
          }
        }
        const af = requestAnimationFrame(frame);
        animFrames.push(af);
      }, delay));
    }
  });
}

// ════════════════════════════════════════════════════════════════════
// NEW FEATURE: RACK ELEVATION (DIGITAL TWIN) WITH INCIDENT INJECTION
// ════════════════════════════════════════════════════════════════════

function drawRackElevation(svg, faultData = null, isThermal = false) {
  const W = svg.parentElement.clientWidth || 800; 
  const baseH = svg.parentElement.clientHeight || 400;
  
  if (typeof currentBlueprint === 'undefined' || !currentBlueprint) {
      svg.setAttribute('viewBox', `0 0 ${W} ${baseH}`);
      svg.style.minHeight = '100%';
      svg.parentElement.style.overflowY = 'hidden';
      label(svg, W/2, baseH/2 - 20, 'SYSTEM UNPROVISIONED', '#e05252', 16, 'middle', '600');
      label(svg, W/2, baseH/2 + 5, 'Please select a hardware blueprint to reconstitute the rack.', '#5a6a85', 12, 'middle');
      return;
  }

  const nodeCount = currentBlueprint.nodes || 8; 
  const totalElements = nodeCount + 2; 
  const isDense = nodeCount > 10; 
  
  const minNodeHeight = 26; 
  const requiredH = (totalElements * minNodeHeight) + 80; 
  const H = Math.max(baseH, requiredH);

  svg.style.minHeight = H + 'px';
  svg.parentElement.style.overflowY = H > baseH ? 'auto' : 'hidden';
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const rackW = W * 0.75; 
  const rackH = H - 20;   
  const startX = W/2 - rackW/2, startY = 10;
  
  svg.appendChild(svgEl('rect', {x: startX, y: startY, width: rackW, height: rackH, rx: 4, fill: '#05070a', stroke: '#2a3347', 'stroke-width': '3'}));
  
  label(svg, W/2, startY + 16, `42U RACK: ${currentBlueprint.name} Cluster`, '#c8d4e8', 12, 'middle', '700');
  line(svg, startX, startY + 28, startX + rackW, startY + 28, '#2a3347', 1.5);

  const availableHeight = rackH - 40; 
  const nodeSpace = availableHeight / totalElements;
  const boxPadding = isDense ? 4 : 6; 
  const boxHeight = nodeSpace - boxPadding;
  
  const fontSize = isDense ? '11' : '13'; 
  const textOffset = isDense ? 4 : 4.5; 

  function scaleText(gObj, yPos) {
      const textNodes = gObj.getElementsByTagName('text');
      for (let t of textNodes) {
          t.setAttribute('font-size', fontSize);
          t.setAttribute('y', yPos + boxHeight / 2 + textOffset); 
      }
  }

  const fabricName = currentBlueprint.fabric || currentBlueprint.fabricDefault || 'Fabric';
  
  const sy1 = startY + 35;
  // Switches run cooler in thermal mode
  let swFill = isThermal ? '#113322' : '#111520'; 
  const gSw1 = node(svg, startX + 10, sy1, rackW - 20, boxHeight, swFill, '#c87941', `${fabricName} Switch`);
  scaleText(gSw1, sy1);

  const sy2 = startY + 35 + nodeSpace;
  const gSw2 = node(svg, startX + 10, sy2, rackW - 20, boxHeight, swFill, '#4a9eff', '10G OOB Ethernet');
  scaleText(gSw2, sy2);

  const power = currentBlueprint.powerPerGpu || 700;
  const prefix = currentBlueprint.labelPrefix || 'Node';

  for (let i = 0; i < nodeCount; i++) {
    const ny = startY + 35 + (nodeSpace * 2) + (i * nodeSpace);
    
    let fill = '#1a2535';
    let stroke = '#76b900';
    let idxPad = i + 1 < 10 ? `0${i+1}` : `${i+1}`;
    
    let labelText = isDense 
        ? `${prefix} ${idxPad} — ${currentBlueprint.vram}GB VRAM`
        : `${prefix} ${idxPad} — ${currentBlueprint.vram}GB VRAM | ${power}W`;
    
    let isFaulty = faultData && faultData.node === i;

    // --- NEW THERMAL LOGIC ---
    if (isThermal) {
        // Mock a thermal profile: mostly cool, some warm, fault is critical hot
        let temp = isFaulty ? 94 : 45 + (i % 4) * 8; 
        fill = temp > 85 ? '#8a2525' : (temp > 60 ? '#8a6515' : '#153525');
        stroke = temp > 85 ? '#e05252' : (temp > 60 ? '#e0a522' : '#22e055');
        labelText = `${prefix} ${idxPad} — Temp: ${temp}°C`;
    } else if (isFaulty) {
        fill = '#2a1515';
        stroke = '#e05252';
        labelText = isDense ? `${prefix} ${idxPad} ⚠ XID ${faultData.xid}` : `${prefix} ${idxPad} — ⚠ CRITICAL FAULT: XID ${faultData.xid}`;
    }
    
    const gNode = node(svg, startX + 10, ny, rackW - 20, boxHeight, fill, stroke, labelText);
    scaleText(gNode, ny);
  }
}

// ════════════════════════════════════════════════════════════════════
// PRESERVED LAB DRAW FUNCTIONS
// ════════════════════════════════════════════════════════════════════
function drawWelcome(svg) {
  clearCanvas();
  const W = svg.clientWidth||700, H = svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const g = svgEl('g');
  svg.appendChild(g);

  label(svg, W/2, H/2-60, 'GPU Infrastructure Simulator', '#e8eef8', 20, 'middle','600');
  label(svg, W/2, H/2-35, '16 interactive labs · animated packet flows · fault injection · quiz', '#5a6a85', 12, 'middle');
  label(svg, W/2, H/2-10, '─────────────────────────────────────────────────', '#2a3347', 11, 'middle');
  const items = ['NVLink · MIG · ECC · XID Faults','CUDA Stack · NGC Containers · DDP Training','InfiniBand · RoCEv2 · NCCL Fallback','Storage Bottleneck · GPUDirect Storage','DCGM Monitoring · Slurm · Kubernetes'];
  items.forEach((item,i) => label(svg, W/2, H/2+15+i*18, item, '#5a6a85', 11, 'middle'));
  label(svg, W/2, H-40, '← Select a lab from the sidebar to begin', '#3d7a4a', 12, 'middle');
}

function drawNVLink(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);

  const isFault = step>=3;
  const gpuW=80, gpuH=52;

  const positions = [
    [W/2-180, H/2-80], [W/2-60,H/2-80], [W/2+60,H/2-80], [W/2+180,H/2-80],
    [W/2-180, H/2+30], [W/2-60,H/2+30], [W/2+60,H/2+30], [W/2+180,H/2+30],
  ];
  label(svg, W/2, 28, 'DGX H100 — 8× H100 SXM5 via NVLink 4.0 / NVSwitch', '#c8d4e8', 12,'middle','600');

  const nsw = svgEl('rect',{x:W/2-50,y:H/2-20,width:100,height:40,rx:6,fill:'#1a2535',stroke:isFault?'#e05252':'#c87941','stroke-width':'1.5'});
  svg.appendChild(nsw);
  label(svg, W/2, H/2+3, 'NVSwitch', '#c87941', 10,'middle','600');

  positions.forEach(([gx,gy],i) => {
    const fill = isFault ? '#2a1515' : '#1a2535';
    const stroke = isFault ? '#e05252' : '#4a9eff';
    node(svg, gx-gpuW/2, gy-gpuH/2, gpuW, gpuH, fill, stroke, `GPU ${i}`, 'H100 SXM5');
    const gc = [gx, gy];
    const nc = [W/2, H/2];
    const col = isFault ? '#e05252' : (step>=2 ? '#76b900' : '#2a3347');
    line(svg, gc[0],gc[1],nc[0],nc[1],col, isFault?1.5:1, isFault?'4 3':'');
    label(svg, gx, gy+gpuH/2+14, isFault?'PHB':'NV4', isFault?'#e05252':'#4a9eff', 8);
  });

  if(step===2 && !isFault) {
    const paths = positions.map(([gx,gy]) => [gx,gy, W/2,H/2]);
    animIntervals.push(setInterval(()=>animPackets(svg, paths, '#76b900', 1, 1200), 200));
  }

  if(isFault) label(svg, W/2, H-30, '⚠  NVLink failed — all GPU pairs showing PHB (PCIe only)', '#e05252', 11,'middle');
  else        label(svg, W/2, H-30, 'All 8 GPUs fully meshed via NVSwitch · 900 GB/s total bandwidth', '#5a6a85', 11,'middle');
}

function drawMIG(svg, step=0) {
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 25, 'MIG Partitioning — H100 80GB → 7 × 10GB Isolated Instances', '#c8d4e8', 12,'middle','600');

  if(step < 0) {
    node(svg, W/2-120, H/2-60, 240, 120, '#1a2535', '#c87941', 'H100 SXM5', '80GB HBM3 · full GPU mode');
    label(svg, W/2, H/2+90, 'Start state: MIG Mode OFF — full GPU available as one unit', '#5a6a85', 11,'middle');
    return;
  }

  if(step===0) {
    node(svg, W/2-120, H/2-60, 240, 120, '#1a2535', '#76b900', 'H100 SXM5', 'MIG Mode ON · ready to create instances');
    label(svg, W/2, H/2+90, 'Step 1: MIG mode enabled at the device level', '#76b900', 11,'middle');
    return;
  }

  if(step>=4) {
    node(svg, W/2-120, H/2-60, 240, 120, '#1a2535', '#c87941', 'H100 SXM5', '80GB HBM3 · full GPU restored');
    label(svg, W/2, H/2+90, 'Step 5: MIG Mode OFF — partition layout removed', '#5a6a85', 11,'middle');
    return;
  }

  const colors = ['#1a3a1a','#1a1a3a','#2a1a1a','#1a2a2a','#2a2a1a','#1a2a1a','#2a1a2a'];
  const strokes = ['#76b900','#4a9eff','#e05252','#00d4d4','#f0b429','#9b7fe8','#c87941'];
  const teams = ['Team A\nInference','Team A\nInference','Team B\nDev','Team B\nDev','Team C\nTest','Team C\nTest','Team C\nTest'];
  const iW=70, iH=56;
  const startX = W/2 - (7*(iW+8))/2 + iW/2;

  for(let i=0;i<7;i++){
    const ix = startX + i*(iW+8);
    const iy = H/2-iH/2;
    const active = step>=1;
    const fill = active ? colors[i] : '#1a2535';
    const stroke = active ? strokes[i] : '#2a3347';
    node(svg, ix-iW/2, iy, iW, iH, fill, stroke, `${i+1}g.10gb`, '10GB HBM3');
    if(step>=3) {
      label(svg, ix, iy+iH+14, teams[i].split('\n')[0], strokes[i], 9);
      label(svg, ix, iy+iH+25, teams[i].split('\n')[1], '#5a6a85', 8);
    }
  }

  const msgs = [
    '',
    'Step 2: 7 instances created — hardware-isolated slices now exist',
    'Step 3: Instance listing verified — reported layout matches the plan',
    'Step 4: Instances assigned — Team A gets 2, Team B gets 2, Team C gets 3'
  ];
  label(svg, W/2, H-30, msgs[Math.min(step,3)], '#5a6a85', 11,'middle');
}

function drawECC(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 25, 'ECC Error Lifecycle — H100 HBM3 Memory', '#c8d4e8', 12,'middle','600');

  const gpu_fill = step>=3 ? '#2a1515' : '#1a2535';
  const gpu_stroke = step>=3 ? '#e05252' : '#4a9eff';
  node(svg, W/2-200, H/2-70, 160, 80, gpu_fill, gpu_stroke, 'GPU 0', 'H100 SXM5');

  const cellSize=14, cols=10, rows=4;
  const cellStartX = W/2-60, cellStartY = H/2-70;
  label(svg, cellStartX+cols*cellSize/2, cellStartY-16, 'HBM3 Memory Cells', '#5a6a85', 9,'middle');

  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) {
    const idx = r*cols+c;
    let fill = '#1a2a1a', stroke='#2a4a2a';
    if(step>=1 && idx < [0,6,14,18,18][Math.min(step,4)]) {
      fill = step>=3 ? '#3a1515' : '#2a2a0a';
      stroke = step>=3 ? '#e05252' : '#f0b429';
    }
    if(step>=3 && idx < 2) { fill='#3a0a0a'; stroke='#e05252'; }
    svg.appendChild(svgEl('rect',{x:cellStartX+c*(cellSize+2),y:cellStartY+r*(cellSize+2),width:cellSize,height:cellSize,rx:2,fill,stroke,'stroke-width':'1'}));
  }

  const panelX = W/2+80;
  svg.appendChild(svgEl('rect',{x:panelX,y:H/2-70,width:130,height:80,rx:4,fill:'#111520',stroke:'#2a3347','stroke-width':'1'}));
  const sbe = [0,19,61,61,61][Math.min(step,4)];
  const dbe = [0,0,0,1,1][Math.min(step,4)];
  label(svg, panelX+65, H/2-52, 'DCGM ECC Monitor', '#5a6a85', 9,'middle');
  label(svg, panelX+65, H/2-33, `SBE (field 156): ${sbe}`, sbe>0?'#f0b429':'#76b900', 11,'middle','600');
  label(svg, panelX+65, H/2-15, `DBE (field 157): ${dbe}`, dbe>0?'#e05252':'#76b900', 11,'middle','600');
  const status = ['Healthy','SBE rising','Trend persists','XID 48 / DBE','DRAINED'];
  const statColors = ['#76b900','#f0b429','#f0b429','#e05252','#e05252'];
  label(svg, panelX+65, H/2+5, status[Math.min(step,4)], statColors[Math.min(step,4)], 11,'middle','700');

  const msgs = ['Healthy baseline — SBE/DBE counters at 0','SBE trend rising — corrected errors accumulating','Persistent SBE trend — maintenance planning needed','XID 48 detected — uncorrectable DBE event','Node drained — no new workloads scheduled'];
  label(svg, W/2, H-30, msgs[Math.min(step,4)], '#5a6a85', 11,'middle');
}

function drawFaultDrill(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 25, 'XID Fault Drill — Responding to Hardware Failures', '#c8d4e8', 12,'middle','600');

  const gpus = [
    {label:'GPU 0',x:60,  y:H/2-80},
    {label:'GPU 1',x:180, y:H/2-80},
    {label:'GPU 2',x:300, y:H/2-80},
    {label:'GPU 3',x:420, y:H/2-80},
    {label:'GPU 4',x:540, y:H/2-80},
  ];

  gpus.forEach(({label:lbl,x,y},i) => {
    let fill='#1a2535', stroke='#4a9eff', sublabel='OK';
    if(step<=1 && i===2) { fill='#2a1515'; stroke='#e05252'; sublabel='XID 48!'; }
    if(step>=2 && step<=3 && i===3) { fill='#2a1515'; stroke='#e05252'; sublabel='XID 79!'; }
    if(step>=4 && i===0) { fill='#2a1010'; stroke='#e05252'; sublabel='NVLink!'; }
    if(step<=1 && i===2) sublabel='DBE error';
    if(step>=2 && step<=3 && i===3) sublabel='GPU hung';
    if(step>=4 && i===0) sublabel='XID 74';
    node(svg, x-40, y-25, 80, 50, fill, stroke, lbl, sublabel);
  });

  const responses = [
    '⚠ XID 48 on GPU 2 — double-bit ECC error detected',
    '✓ DBE confirmed (dcgmi field 157=2) — drain and RMA',
    '⚠ XID 79 on GPU 3 — GPU completely hung',
    '→ Attempting GPU reset: nvidia-smi --gpu-reset -i 3',
    '⚠ XID 74 on GPU 0 — NVLink error on Link 2',
    '→ Check nvidia-smi nvlink -s — Link 2 disabled'
  ];
  const rColors = ['#f0b429','#76b900','#e05252','#4a9eff','#f0b429','#4a9eff'];
  svg.appendChild(svgEl('rect',{x:60,y:H/2+20,width:W-120,height:50,rx:4,fill:'#111520',stroke:'#2a3347'}));
  label(svg, W/2, H/2+38, 'Response', '#5a6a85', 9,'middle');
  label(svg, W/2, H/2+58, responses[Math.min(step,5)], rColors[Math.min(step,5)], 11,'middle','600');
}

function drawCUDAStack(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 22, 'NVIDIA Software Stack — Layer Compatibility Check', '#c8d4e8', 12,'middle','600');

  const layers = [
    {name:'Application / Model',  ver:'GPT, LLaMA, BERT...', own:false,  color:'#2a3a1a', stroke:'#76b900'},
    {name:'AI Framework',          ver:'PyTorch 2.4 / TF 2.16', own:false, color:'#1a2a3a', stroke:'#4a9eff'},
    {name:'cuDNN / NCCL / TensorRT',ver:'cuDNN 9.x',         own:true,  color:'#2a1a3a', stroke:'#9b7fe8'},
    {name:'CUDA Runtime',          ver:'CUDA 12.4',           own:true,  color:'#1a2a2a', stroke:'#00d4d4'},
    {name:'NVIDIA Driver',         ver:'550.54.15',           own:true,  color:'#2a1a1a', stroke:'#c87941'},
    {name:'GPU Hardware',          ver:'H100 SXM5',           own:true,  color:'#1a1a2a', stroke:'#4a9eff'},
  ];

  const layH=38, layW=300, startX=W/2-layW/2, startY=30;
  layers.forEach(({name,ver,own,color,stroke},i) => {
    const y = startY + i*(layH+4);
    const isMismatch = step===3 && i===1;
    const fixed = step>=4;
    const verified = fixed || (step===0 && i>=4) || (step===1 && i>=3) || (step===2 && (i===1 || i>=3));
    const fill = isMismatch ? '#2a0a0a' : color;
    const st = isMismatch ? '#e05252' : (verified ? stroke : '#2a3347');
    svg.appendChild(svgEl('rect',{x:startX,y,width:layW,height:layH,rx:3,fill,stroke:st,'stroke-width':'1.5'}));
    label(svg, startX+layW/2, y+15, name, isMismatch?'#e05252':'#e8eef8', 11,'middle','600');
    label(svg, startX+layW/2, y+28, ver, isMismatch?'#e05252':'#5a6a85', 9,'middle');
    label(svg, startX-8, y+layH/2, own?'←YOU':' ', '#76b900', 8,'end');
    if(verified && !isMismatch)
      label(svg, startX+layW+8, y+layH/2, '✓', '#76b900', 11,'start');
    if(isMismatch)
      label(svg, startX+layW+8, y+layH/2, '✗', '#e05252', 12,'start');
  });

  const msgs = ['Driver layer captured — base of the stack is known','CUDA toolkit checked against the driver','Framework import checked against CUDA','Framework/CUDA version mismatch found','Fixed with validated NGC container ✓'];
  label(svg, W/2, H-20, msgs[Math.min(step,4)], step===3?'#e05252':'#5a6a85', 11,'middle');
}

function drawContainer(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 22, 'NGC Container Flow — From Registry to GPU', '#c8d4e8', 12,'middle','600');

  node(svg, 40, H/2-40, 110, 50, '#1a2535','#c87941','NGC Registry','nvcr.io');
  node(svg, 200, H/2-40, 110, 50, '#1a2535','#4a9eff','Docker Engine','Host runtime');
  node(svg, 380, H/2-40, 130, 50, step>=3?'#1a3a1a':'#1a2535', step>=3?'#76b900':'#2a3347','Container','pytorch:24.03-py3');
  node(svg, 570, H/2-40, 90, 50, step>=4?'#1a2a1a':'#1a2535', step>=4?'#76b900':'#2a3347','GPU 0-7','H100 SXM5');

  if(step>=1) arrow(svg, 152,H/2-15, 198,H/2-15,'#c87941','pull');
  if(step>=2) arrow(svg, 312,H/2-15, 378,H/2-15,'#4a9eff','docker run');
  if(step>=3) arrow(svg, 512,H/2-15, 568,H/2-15,'#76b900','--gpus all');

  if(step>=1 && step<2) animPackets(svg,[[152,H/2-15,198,H/2-15]],'#c87941',3,800);
  if(step>=2 && step<3) animPackets(svg,[[312,H/2-15,378,H/2-15]],'#4a9eff',3,600);
  if(step>=3) animPackets(svg,[[512,H/2-15,568,H/2-15]],'#76b900',2,600);

  const msgs=['Pull container from NGC registry','Downloading 8.2GB image...','Container running with GPU access','Training inside container','GPU metrics visible from docker exec'];
  label(svg, W/2, H-25, msgs[Math.min(step,4)], '#5a6a85', 11,'middle');
}

function drawDDP(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 22, 'Distributed Data Parallel — 2 Nodes × 8 GPUs = 16 Ranks', '#c8d4e8', 12,'middle','600');

  const node1X=80, node2X=420;
  svg.appendChild(svgEl('rect',{x:node1X-10,y:50,width:290,height:260,rx:5,fill:'#0e1520',stroke:'#2a3347','stroke-width':'1.5'}));
  svg.appendChild(svgEl('rect',{x:node2X-10,y:50,width:290,height:260,rx:5,fill:'#0e1520',stroke:'#2a3347','stroke-width':'1.5'}));
  label(svg, node1X+135, 70, 'gpu-node-01 (ranks 0-7)', '#5a6a85', 9,'middle');
  label(svg, node2X+135, 70, 'gpu-node-02 (ranks 8-15)', '#5a6a85', 9,'middle');

  for(let i=0;i<4;i++) {
    for(let j=0;j<2;j++) {
      const gx = node1X+10+j*130, gy = 80+i*50;
      const rank = i*2+j;
      const active = step>=0;
      const syncing = step===3;
      const fill = syncing?'#1a1a2a':active?'#1a2a1a':'#1a2535';
      const stroke = syncing?'#00d4d4':active?'#76b900':'#2a3347';
      node(svg, gx, gy, 110, 36, fill, stroke, `Rank ${rank}`, step>=2?`grad[${rank}]`:'');
    }
  }
  for(let i=0;i<4;i++) {
    for(let j=0;j<2;j++) {
      const gx = node2X+10+j*130, gy = 80+i*50;
      const rank = 8+i*2+j;
      const syncing = step===3;
      const fill = syncing?'#1a1a2a':step>=0?'#1a2a1a':'#1a2535';
      const stroke = syncing?'#00d4d4':step>=0?'#76b900':'#2a3347';
      node(svg, gx, gy, 110, 36, fill, stroke, `Rank ${rank}`, step>=2?`grad[${rank}]`:'');
    }
  }

  const ibColor = step>=3?'#00d4d4':'#2a3347';
  line(svg, node1X+280, H/2, node2X-10, H/2, ibColor, step>=3?2.5:1, step>=3?'':'4 4');
  label(svg, (node1X+280+node2X-10)/2, H/2-10, step>=3?'AllReduce via IB NDR':'InfiniBand NDR 400Gb/s', step>=3?'#00d4d4':'#5a6a85', 9,'middle');

  if(step===3) animPackets(svg,[[node1X+280,H/2,node2X-10,H/2],[node2X-10,H/2,node1X+280,H/2]],'#00d4d4',4,600);

  const msgs=['DDP launched — all ranks joined the world','Forward pass: each rank processes 1/16 of batch','Backward pass: local gradients computed per rank','AllReduce: NCCL averages gradients across all 16 ranks','Weights updated — all 16 replicas now identical ✓','Storage bottleneck! GPUs idle waiting for next batch'];
  label(svg, W/2, H-18, msgs[Math.min(step,5)], step===5?'#e05252':'#5a6a85', 11,'middle');
}

function drawAllReduce(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 22, 'NCCL AllReduce — Ring Algorithm', '#c8d4e8', 12,'middle','600');

  const gpuCount=8, r=110;
  const cx=W/2, cy=H/2+10;
  const positions = Array.from({length:gpuCount},(_,i)=>{
    const angle = (i/gpuCount)*2*Math.PI - Math.PI/2;
    return [cx+r*Math.cos(angle), cy+r*Math.sin(angle)];
  });

  for(let i=0;i<gpuCount;i++){
    const [x1,y1]=positions[i];
    const [x2,y2]=positions[(i+1)%gpuCount];
    const active = step>=1 && step<=2;
    const color = step>=5?'#e05252':active?'#00d4d4':'#2a3347';
    const dash = step>=5?'4 3':'';
    line(svg, x1,y1,x2,y2,color,active?2:1,dash);
  }

  positions.forEach(([gx,gy],i) => {
    const fill = step>=1?'#1a2a1a':'#1a2535';
    const stroke = step>=5?'#e05252':step>=3?'#76b900':step>=1?'#00d4d4':'#4a9eff';
    node(svg, gx-25, gy-18, 50, 36, fill, stroke, `GPU${i}`, step>=1?`G${i}`:'');
  });

  const centerMsgs=['NCCL ready','IB selected','Reduce-Scatter: round 1/7','Reduce-Scatter: round 7/7 ✓','All-Gather complete ✓','TCP FALLBACK!','IB restored ✓'];
  const centerColors=['#5a6a85','#4a9eff','#00d4d4','#76b900','#76b900','#e05252','#76b900'];
  label(svg, cx, cy-10, 'AllReduce', '#5a6a85', 9,'middle');
  label(svg, cx, cy+8, centerMsgs[Math.min(step,6)], centerColors[Math.min(step,6)], 11,'middle','700');

  if(step>=1 && step<=2) {
    const paths=[];
    for(let i=0;i<gpuCount;i++) {
      const [x1,y1]=positions[i];
      const [x2,y2]=positions[(i+1)%gpuCount];
      paths.push([x1,y1,x2,y2]);
    }
    animIntervals.push(setInterval(()=>animPackets(svg,paths,'#00d4d4',2,800),150));
  }
  if(step>=3 && step<=4) {
    const paths=[];
    for(let i=0;i<gpuCount;i++) {
      const [x1,y1]=positions[(i+1)%gpuCount];
      const [x2,y2]=positions[i];
      paths.push([x1,y1,x2,y2]);
    }
    animIntervals.push(setInterval(()=>animPackets(svg,paths,'#76b900',2,800),150));
  }

  const msgs=['Select NCCL path','Checking network: IB or Socket?','Phase 1: Reduce-Scatter (all GPUs send simultaneously)','Phase 2: All-Gather (averaged gradients distributed)','AllReduce complete — all GPUs synchronized','IB disabled: TCP Socket fallback (23× slower)','IB restored — full performance ✓'];
  label(svg, W/2, H-18, msgs[Math.min(step,6)], step===5?'#e05252':'#5a6a85', 11,'middle');
}

function drawIBFabric(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 22, 'InfiniBand NDR Fabric — 400 Gb/s per port', '#c8d4e8', 12,'middle','600');

  const sw1x=W/2-120, sw2x=W/2+50;
  node(svg, sw1x-40, 50, 90, 40, '#1a2535','#c87941','IB Switch A','NDR 400Gb/s');
  node(svg, sw2x-40, 50, 90, 40, '#1a2535','#c87941','IB Switch B','NDR 400Gb/s');
  line(svg, sw1x+5, 70, sw2x-5, 70, '#c87941', 1.5);

  const nodes = [{x:80,label:'node-01'},{x:200,label:'node-02'},{x:320,label:'node-03'},{x:440,label:'node-04'},{x:560,label:'node-05'},{x:630,label:'node-06'}];
  nodes.forEach(({x,label:lbl},i) => {
    const isFault = step>=3 && i===5;
    const fill = isFault?'#2a1515':'#1a2535';
    const stroke = isFault?'#e05252':step>=2?'#76b900':'#4a9eff';
    node(svg, x-35, H-100, 70, 45, fill, stroke, lbl, isFault?'State:Down':'State:Active');
    const sw = i<3?sw1x:sw2x;
    const swY = 90;
    const color = isFault?'#e05252':step>=2?'#76b900':'#4a9eff';
    line(svg, x, H-100, sw, swY, color, isFault?1:1.5, isFault?'4 3':'');
    if(!isFault && step>=2) animPackets(svg,[[x,H-100,sw,swY]],'#4a9eff',1,1200);
  });

  const msgs=['IB fabric topology','Checking port states...','All ports Active ✓  —  fabric healthy','Fault: cable disconnected on node-06','ibdiagnet identifies bad link','Sweep complete: 1 bad port isolated'];
  label(svg, W/2, H-20, msgs[Math.min(step,5)], step>=3?'#f0b429':'#5a6a85', 11,'middle');
}

function drawRoCE(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 22, 'RoCEv2 + PFC/ECN — Lossless Ethernet for RDMA', '#c8d4e8', 12,'middle','600');

  node(svg, 80, H/2-30, 100, 60, '#1a2535','#4a9eff','GPU Node A','RoCEv2 NIC');
  node(svg, W-180, H/2-30, 100, 60, '#1a2535','#4a9eff','GPU Node B','RoCEv2 NIC');

  const sw_fill = step===4?'#2a1515':'#1a2535';
  const sw_stroke = step===4?'#e05252':'#c87941';
  node(svg, W/2-60, H/2-30, 120, 60, sw_fill, sw_stroke, 'Ethernet Switch','PFC + ECN');

  const color = step>=3?'#00d4d4':'#2a3347';
  line(svg, 180, H/2, W/2-60, H/2, color, 1.5);
  line(svg, W/2+60, H/2, W-180, H/2, color, 1.5);

  label(svg, (180+W/2-60)/2, H/2-12, 'RDMA', '#00d4d4', 9,'middle');
  label(svg, (W/2+60+W-180)/2, H/2-12, 'RDMA', '#00d4d4', 9,'middle');

  if(step>=1) {
    svg.appendChild(svgEl('rect',{x:W/2-50,y:H/2+50,width:100,height:30,rx:3,fill:'#1a2535',stroke:step>=1?'#76b900':'#2a3347'}));
    label(svg, W/2, H/2+60, 'PFC: ON', '#76b900', 9,'middle');
    label(svg, W/2, H/2+73, 'ECN: ON', step>=2?'#76b900':'#2a3347', 9,'middle');
  }

  if(step>=3) animPackets(svg,[[180,H/2,W/2-60,H/2],[W/2+60,H/2,W-180,H/2]],'#00d4d4',3,800);

  if(step===4) {
    for(let i=0;i<5;i++) {
      const px=W/2-55+i*22, py=H/2-10;
      const pkt2 = svgEl('rect',{x:px,y:py,width:10,height:8,rx:2,fill:'#e05252','opacity':'0.7'});
      svg.appendChild(pkt2);
    }
    label(svg, W/2, H/2+40, 'PFC STORM — excessive pause frames!', '#e05252', 10,'middle');
  }

  const msgs=['PFC and ECN provide lossless Ethernet for RDMA','PFC enabled — pause frames prevent drops','ECN enabled — early congestion signal','RDMA flowing — 92 GB/s ✓','Fault: PFC storm — buffer thresholds too aggressive','Tuned switch buffers — PFC storm resolved ✓'];
  label(svg, W/2, H-20, msgs[Math.min(step,5)], step===4?'#e05252':'#5a6a85', 11,'middle');
}

function drawNCCLFallback(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 22, 'NCCL Fallback — Diagnosing TCP Socket vs InfiniBand', '#c8d4e8', 12,'middle','600');

  const isFixed = step>=4;
  const isFault = step>=0 && step<4;

  node(svg, 60, H/2-50, 130, 60, '#1a2535','#4a9eff','gpu-node-01','rank 0');
  node(svg, W-190, H/2-50, 130, 60, '#1a2535','#4a9eff','gpu-node-02','rank 1');

  const pathColor = isFixed?'#4a9eff':isFault?'#e05252':'#2a3347';
  const pathLabel = isFixed?'IB: 180 GB/s':isFault?'TCP: 8 GB/s':'';
  line(svg, 190, H/2-20, W-190, H/2-20, pathColor, isFixed?2:isFault?2:1, isFault&&!isFixed?'6 4':'');
  if(pathLabel) label(svg, W/2, H/2-35, pathLabel, pathColor, 10,'middle','600');

  svg.appendChild(svgEl('rect',{x:W/2-120,y:H/2+30,width:240,height:60,rx:4,fill:'#111520',stroke:'#2a3347'}));
  const envColor = step>=3?'#76b900':'#e05252';
  label(svg, W/2, H/2+48, step>=3?'NCCL_IB_DISABLE → unset':'NCCL_IB_DISABLE=1  ← CAUSE!', envColor, 10,'middle','600');
  label(svg, W/2, H/2+65, step>=3?'NCCL_IB_HCA=mlx5_0 → set':'Blocks all InfiniBand regardless of hardware', step>=3?'#4a9eff':'#f0b429', 9,'middle');

  if(isFixed) animPackets(svg,[[190,H/2-20,W-190,H/2-20]],'#4a9eff',4,600);

  const msgs=['TCP fallback detected — 4% performance','NCCL_IB_DISABLE=1 found in environment','IB hardware verified healthy (ibstat: Active)','Fix applied: unset NCCL_IB_DISABLE; set NCCL_IB_HCA','Verified: NCCL now using IB ✓','Before: 8 GB/s → After: 182 GB/s (+23×) ✓'];
  label(svg, W/2, H-20, msgs[Math.min(step,5)], step<=2?'#e05252':step===3?'#f0b429':'#76b900', 11,'middle');
}

function drawStorage(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 22, 'Storage Bottleneck — GPU Sawtooth Pattern', '#c8d4e8', 12,'middle','600');

  node(svg, 50, H/2-30, 100, 60, '#1a2535','#9b7fe8','NFS/Lustre','Storage');
  node(svg, W-150, H/2-30, 100, 60, step>=5?'#1a3a1a':'#1a2535', step>=5?'#76b900':'#4a9eff','GPU Cluster','8× H100');
  node(svg, W/2-60, H/2-25, 120, 50, '#1a2535','#c87941','DataLoader','prefetch buffer');

  const c1 = step>=1?'#9b7fe8':'#2a3347';
  const c2 = step>=4?'#76b900':'#2a3347';
  arrow(svg, 150, H/2, W/2-60, H/2, c1, '');
  arrow(svg, W/2+60, H/2, W-150, H/2, c2, '');

  if(step>=1 && step<=3) animPackets(svg,[[150,H/2,W/2-55,H/2]],'#9b7fe8',3,900);
  if(step>=4) {
    animPackets(svg,[[150,H/2,W/2-55,H/2]],'#76b900',4,500);
    animPackets(svg,[[W/2+60,H/2,W-150,H/2]],'#76b900',4,500);
  }

  const chartX=W-180, chartY=45, chartW=120, chartH=80;
  svg.appendChild(svgEl('rect',{x:chartX,y:chartY,width:chartW,height:chartH,rx:3,fill:'#0e1520',stroke:'#2a3347'}));
  label(svg, chartX+chartW/2, chartY+12, 'GPU SM Util', '#5a6a85', 8,'middle');

  const sawColors = step>=5?'#76b900':step>=3?'#f0b429':'#e05252';
  if(step>=2) {
    const pts = step>=5
      ? '0,70 12,10 24,12 36,10 48,11 60,10 72,12 84,10'  
      : '0,70 8,10 16,10 24,70 32,70 40,10 48,10 56,70 64,70 72,10 80,10'; 
    const polyline = svgEl('polyline',{points:pts.split(' ').map(p=>{const[x,y]=p.split(',');return `${chartX+10+parseFloat(x)},${chartY+parseFloat(y)}`}).join(' '),fill:'none',stroke:sawColors,'stroke-width':'1.5'});
    svg.appendChild(polyline);
  }

  if(step>=1) {
    const storUtil = step>=4?30:step>=1?100:0;
    const barColor = storUtil>=95?'#e05252':'#76b900';
    svg.appendChild(svgEl('rect',{x:55,y:H-60,width:90,height:12,rx:2,fill:'#1a2535',stroke:'#2a3347'}));
    svg.appendChild(svgEl('rect',{x:55,y:H-60,width:storUtil*0.9,height:12,rx:2,fill:barColor}));
    label(svg, 100, H-45, `iostat %util: ${storUtil}%`, barColor, 9,'middle');
  }

  const msgs=['Healthy storage — data flowing continuously','Storage saturating — single OST bottleneck','GPU sawtooth: GPU idles when storage is empty','lfs getstripe shows stripe_count: 1','Fixed: lfs setstripe -c 8 — striped across 8 OSTs','DataLoader optimised + Lustre fixed — continuous flow ✓'];
  label(svg, W/2, H-20, msgs[Math.min(step,5)], step>=4?'#76b900':step>=1?'#e05252':'#5a6a85', 11,'middle');
}

function drawGDS(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 22, 'GPUDirect Storage — Traditional vs GDS Data Path', '#c8d4e8', 12,'middle','600');

  node(svg, 40, H/2-80, 90, 45, '#1a2535','#9b7fe8','NVMe SSD','7 GB/s local');
  const traditionalPath = step===0 || step===3;
  const directPath = !traditionalPath;
  node(svg, 40, H/2+20, 90, 45, '#1a2535', traditionalPath?'#c87941':'#2a3347', 'CPU/RAM', traditionalPath?'in hot path':'bypassed!');
  node(svg, W-130, H/2-30, 100, 50, '#1a2535','#76b900','GPU VRAM','80GB HBM3');

  if(traditionalPath) {
    const c='#c87941';
    arrow(svg, 130, H/2-57, W/2, H/2+30, c, '');  
    arrow(svg, W/2, H/2+30, W-130, H/2, c, '');   
    label(svg, W/2-50, H/2-20, '① NVMe→CPU', c, 9);
    label(svg, W/2+50, H/2+45, '② CPU→GPU', c, 9);
    if(step>=3) animPackets(svg,[[130,H/2-57,W/2,H/2+35],[W/2,H/2+35,W-130,H/2]],'#c87941',2,900);
    label(svg, W/2, H/2-60, step===3?'Traditional benchmark · ~890 MB/s':'2 copies · CPU in hot path', '#c87941', 10,'middle');
  } else {
    const c='#00d4d4';
    arrow(svg, 130, H/2-57, W-130, H/2, c, 'DMA direct');
    if(step>=4) animPackets(svg,[[130,H/2-57,W-130,H/2]],'#00d4d4',4,500);
    label(svg, W/2, H/2-60, step>=4?'GDS benchmark · 2.4 GB/s (+2.7×)':'Fewer CPU copies · DMA data path', '#00d4d4', 10,'middle');
    label(svg, 85, H/2+42, 'CPU', '#2a3347', 10,'middle');
    label(svg, 85, H/2+55, 'control path', '#2a3347', 9,'middle');
  }

  const msgs=['Traditional: NVMe→CPU RAM→GPU VRAM (2 copies)','GDS concept: storage DMA reaches GPU memory without the usual CPU bounce buffer','GDS runtime verified — cuFile software path available','Traditional benchmark: 890 MB/s — CPU at 35%','GDS benchmark: 2.4 GB/s — CPU at 4% ✓'];
  label(svg, W/2, H-20, msgs[Math.min(step,4)], directPath?'#00d4d4':'#5a6a85', 11,'middle');
}

function drawMonitoring(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 22, 'DCGM Monitoring Stack — node_exporter for GPUs', '#c8d4e8', 12,'middle','600');

  const components = [
    {x:60,  label:'GPU Hardware',   sub:'H100 × 8',     color:'#4a9eff',step:0},
    {x:180, label:'DCGM Exporter', sub:':9400/metrics', color:'#76b900',step:0},
    {x:310, label:'Prometheus',    sub:'15s scrape',    color:'#f0b429',step:2},
    {x:440, label:'Grafana',       sub:'ID 12239',      color:'#c87941',step:3},
    {x:580, label:'Alertmanager',  sub:'PagerDuty',     color:'#9b7fe8',step:4},
  ];

  components.forEach(({x,label:lbl,sub,color,step:minStep},i) => {
    const active = step>=minStep;
    const fill = active?'#1a2535':'#111520';
    const stroke = active?color:'#2a3347';
    node(svg, x-50, H/2-30, 100, 55, fill, stroke, lbl, sub);
    if(i<components.length-1){
      const nc=components[i+1];
      const active2 = step>=Math.max(minStep,nc.step);
      line(svg, x+50, H/2-2, nc.x-50, H/2-2, active2?nc.color:'#2a3347', active2?1.5:1);
      if(active2) animPackets(svg,[[x+50,H/2-2,nc.x-50,H/2-2]],nc.color,2,900);
    }
  });

  if(step>=5) {
    svg.appendChild(svgEl('rect',{x:530,y:H/2+40,width:100,height:30,rx:3,fill:'rgba(224,82,82,0.15)',stroke:'#e05252'}));
    label(svg, 580, H/2+55, '🔔 CRITICAL ALERT!', '#e05252', 9,'middle','600');
  }

  const msgs=['DCGM monitoring stack overview','DCGM Exporter deployed — metrics exposed at :9400','Prometheus scraping all GPU nodes every 15s','Grafana dashboard 12239 — visualising fleet metrics','Alertmanager routing alerts to PagerDuty','Alert fired! ECC DBE event → PagerDuty P1 ✓'];
  label(svg, W/2, H-20, msgs[Math.min(step,5)], step>=5?'#e05252':'#5a6a85', 11,'middle');
}

function drawSlurm(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 22, 'Slurm Scheduler — Job Lifecycle', '#c8d4e8', 12,'middle','600');

  node(svg, W/2-60, 50, 120, 40, '#1a2535','#c87941','slurmctld','Scheduler');

  const states = [
    {x:100, label:'SUBMITTED', color:'#4a9eff'},
    {x:240, label:'PENDING',   color:'#f0b429'},
    {x:380, label:'RUNNING',   color:'#76b900'},
    {x:520, label:'COMPLETED', color:'#5a6a85'},
  ];
  const faultState = step>=4;
  states.forEach(({x,label:lbl,color},i) => {
    const active = step>(i===0?-1:i===1?0:i===2?2:4);
    const isDrain = faultState && i===3;
    const fill = isDrain?'#2a1515':active?'#1a2535':'#111520';
    const stroke = isDrain?'#e05252':active?color:'#2a3347';
    node(svg, x-50, H/2-25, 100, 50, fill, stroke, isDrain?'DRAINED':lbl, '');
    if(i<states.length-1){
      line(svg, x+50, H/2, states[i+1].x-50, H/2, active?color:'#2a3347', 1.5);
    }
  });

  for(let i=0;i<6;i++){
    const nx=80+i*100;
    const isDrained = faultState && i===4;
    const fill = isDrained?'#2a1515':'#1a2535';
    const stroke = isDrained?'#e05252':step>=2?'#76b900':'#4a9eff';
    const sublabel = isDrained?'DRAIN':'Active';
    node(svg, nx-35, H-85, 70, 35, fill, stroke, `node-0${i+1}`, sublabel);
    if(step>=2 && !isDrained) line(svg, nx, H-85, W/2, 90, '#76b900', 1, '3 3');
  }

  const msgs=['Idle — no jobs in queue','Job 99234 submitted (--nodes=4 --gres=gpu:8)','PENDING: Reason=Priority — higher priority jobs first','Running on 4 nodes — 32 GPUs allocated','Checking fairshare: alice score = 0.034 (low)','Draining gpu-node-05: ECC fault — state=drain','Node resumed: state=resume ✓'];
  label(svg, W/2, H-20, msgs[Math.min(step,6)], step===4?'#e05252':'#5a6a85', 11,'middle');
}

function drawK8s(svg, step=0) {
  if(step < 0) step = 0;
  const W=svg.clientWidth||700, H=svg.clientHeight||380;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  label(svg, W/2, 22, 'Kubernetes GPU Operations', '#c8d4e8', 12,'middle','600');

  node(svg, W/2-60, 44, 120, 40, '#1a2535','#4a9eff','kube-apiserver','Control Plane');

  const opColor = step>=0?'#76b900':'#2a3347';
  node(svg, 60, 45, 110, 40, '#1a2535', opColor, 'GPU Operator', 'DaemonSets');

  const nodeStates = [
    {x:80,  label:'gpu-w-01', gpus:8, used:6},
    {x:200, label:'gpu-w-02', gpus:8, used:8},
    {x:320, label:'gpu-w-03', gpus:8, used:3},
    {x:440, label:'gpu-w-04', gpus:8, used:0},
    {x:560, label:'gpu-w-05', gpus:8, used:8},
  ];

  nodeStates.forEach(({x,label:lbl,gpus,used},i) => {
    const isDrained = step>=4 && i===2;
    const fill = isDrained?'#2a1515':'#1a2535';
    const stroke = isDrained?'#e05252':used===gpus?'#f0b429':used===0?'#5a6a85':'#76b900';
    node(svg, x-45, H/2-20, 90, 50, fill, stroke, lbl, isDrained?'Draining':`${used}/${gpus} GPU`);
    line(svg, x, H/2-20, W/2, 84, '#2a3347', 1, '2 3');

    const barW = 80, barH = 4, bx=x-40, by=H/2+36;
    svg.appendChild(svgEl('rect',{x:bx,y:by,width:barW,height:barH,rx:1,fill:'#1a2535'}));
    if(!isDrained) svg.appendChild(svgEl('rect',{x:bx,y:by,width:barW*(used/gpus),height:barH,rx:1,fill:used===gpus?'#f0b429':used===0?'#2a3347':'#76b900'}));
  });

  if(step>=2) {
    svg.appendChild(svgEl('rect',{x:W/2-70,y:H-80,width:140,height:40,rx:4,fill:'#2a1515',stroke:'#e05252'}));
    label(svg, W/2, H-60, 'training-pod', '#e05252', 10,'middle','600');
    label(svg, W/2, H-47, step>=3?'NetworkPolicy blocked!':'Insufficient nvidia.com/gpu', '#f0b429', 9,'middle');
  }

  const msgs=['GPU Operator manages full NVIDIA stack on every node','Verifying nvidia.com/gpu registered as schedulable resource','Pod stuck PENDING — all GPU nodes fully allocated','NetworkPolicy blocking NCCL port 29500 — rendezvous fails','Draining gpu-node-03 before maintenance','Gang scheduling: PodGroup ensures all 16 ranks start together ✓'];
  label(svg, W/2, H-18, msgs[Math.min(step,5)], step===3||step===2?'#e05252':'#5a6a85', 11,'middle');
}
