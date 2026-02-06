import React, { useEffect, useRef, useState } from 'react';
import * as NGL from 'ngl';
import { GridBox } from '../types';
import { IconLoader, IconSettings } from './Icons';

interface MolecularViewerProps {
  proteinFile: File | null;
  ligandFile: File | null;
  gridBox: GridBox;
  isProcessing?: boolean;
  processStatus?: string;
}

export const MolecularViewer: React.FC<MolecularViewerProps> = ({
  proteinFile,
  ligandFile,
  gridBox,
  isProcessing,
  processStatus
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<NGL.Stage | null>(null);
  const proteinCompRef = useRef<any>(null); // NGL Component types can be tricky with esm.sh imports
  const ligandCompRef = useRef<any>(null);
  const shapeCompRef = useRef<any>(null);
  
  // Display controls
  const [showProtein, setShowProtein] = useState(true);
  const [showLigand, setShowLigand] = useState(true);
  
  // Initialize Stage
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Create NGL Stage
    const stage = new NGL.Stage(containerRef.current, { backgroundColor: '#0f172a' }); // matches slate-900
    stageRef.current = stage;
    
    // Resize handler
    const handleResize = () => stage.handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      stage.dispose();
    };
  }, []);

  // Handle Grid Box Update
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // Remove old shape
    if (shapeCompRef.current) {
      stage.removeComponent(shapeCompRef.current);
      shapeCompRef.current = null;
    }

    // Define Grid Box corners based on center and size
    const cx = gridBox.center_x;
    const cy = gridBox.center_y;
    const cz = gridBox.center_z;
    const sx = gridBox.size_x / 2;
    const sy = gridBox.size_y / 2;
    const sz = gridBox.size_z / 2;

    const corners: [number, number, number][] = [
      [cx - sx, cy - sy, cz - sz],
      [cx + sx, cy - sy, cz - sz],
      [cx + sx, cy + sy, cz - sz],
      [cx - sx, cy + sy, cz - sz],
      [cx - sx, cy - sy, cz + sz],
      [cx + sx, cy - sy, cz + sz],
      [cx + sx, cy + sy, cz + sz],
      [cx - sx, cy + sy, cz + sz]
    ];
    
    // Edges connecting corners
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0], // bottom
      [4, 5], [5, 6], [6, 7], [7, 4], // top
      [0, 4], [1, 5], [2, 6], [3, 7]  // pillars
    ];

    const shape = new NGL.Shape('gridBox');
    edges.forEach(edge => {
      // Add yellow cylinders to represent lines (radius 0.1)
      shape.addCylinder(corners[edge[0]], corners[edge[1]], [1, 1, 0] as [number, number, number], 0.1, 'box-edge');
    });

    const comp = stage.addComponentFromObject(shape);
    if (comp) {
        comp.addRepresentation('buffer', { opacity: 0.5 });
        shapeCompRef.current = comp;
    }
    
  }, [gridBox]);

  // Load Protein
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // Clean up old protein
    if (proteinCompRef.current) {
      stage.removeComponent(proteinCompRef.current);
      proteinCompRef.current = null;
    }

    if (proteinFile) {
      const url = URL.createObjectURL(proteinFile);
      const ext = proteinFile.name.split('.').pop() || 'pdb';
      
      stage.loadFile(url, { ext }).then((comp: any) => {
        proteinCompRef.current = comp;
        comp.addRepresentation('cartoon', { colorScheme: 'chainid' });
        comp.autoView();
      });
    }
  }, [proteinFile]);

  // Load Ligand
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // Clean up old ligand
    if (ligandCompRef.current) {
      stage.removeComponent(ligandCompRef.current);
      ligandCompRef.current = null;
    }

    if (ligandFile) {
      const url = URL.createObjectURL(ligandFile);
      const ext = ligandFile.name.split('.').pop() || 'sdf';
      
      stage.loadFile(url, { ext }).then((comp: any) => {
        ligandCompRef.current = comp;
        comp.addRepresentation('ball+stick');
        // Don't autoView here to keep protein context if present, 
        // or autoView only if protein missing
        if (!proteinCompRef.current) comp.autoView();
      });
    }
  }, [ligandFile]);

  // Toggle Visibility
  useEffect(() => {
    if (proteinCompRef.current) {
      proteinCompRef.current.setVisibility(showProtein);
    }
  }, [showProtein, proteinFile]);

  useEffect(() => {
    if (ligandCompRef.current) {
      ligandCompRef.current.setVisibility(showLigand);
    }
  }, [showLigand, ligandFile]);

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
        <div ref={containerRef} className="w-full h-full cursor-move" />
        
        {/* Overlay Controls */}
        <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur p-4 rounded-lg border border-slate-700 w-48 shadow-xl z-10">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                <IconSettings className="w-3 h-3" /> View Controls
            </h4>
            <div className="space-y-2">
                <label className="flex items-center justify-between text-sm text-slate-200 cursor-pointer select-none">
                    <span>Protein</span>
                    <input 
                      type="checkbox" 
                      checked={showProtein} 
                      onChange={e => setShowProtein(e.target.checked)} 
                      className="accent-science-500 w-4 h-4 rounded" 
                    />
                </label>
                <label className="flex items-center justify-between text-sm text-slate-200 cursor-pointer select-none">
                    <span>Ligand</span>
                    <input 
                      type="checkbox" 
                      checked={showLigand} 
                      onChange={e => setShowLigand(e.target.checked)} 
                      className="accent-emerald-500 w-4 h-4 rounded" 
                    />
                </label>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700 text-[10px] text-slate-500">
                Left-Click: Rotate<br/>
                Right-Click: Pan<br/>
                Scroll: Zoom
            </div>
        </div>

        {/* Loading Overlay */}
        {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                <IconLoader className="w-12 h-12 text-science-500 mb-4" />
                <div className="font-mono text-science-300 font-medium">{processStatus}</div>
                <div className="w-64 h-1 bg-slate-800 mt-6 rounded-full overflow-hidden">
                    <div className="h-full bg-science-500 animate-progress origin-left"></div>
                </div>
            </div>
        )}
    </div>
  );
};