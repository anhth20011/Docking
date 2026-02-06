import React, { useState } from 'react';
import JSZip from 'jszip';
import { GridBox, PreparationSteps, DockingResult, DockingConfig } from '../types';
import { IconUpload, IconSettings, IconCheck, IconLoader, IconDownload, IconAtom, IconPlay } from './Icons';
import { MolecularViewer } from './MolecularViewer';

// --- Helper Functions ---

const parseVinaResult = (content: string): DockingResult[] => {
  const results: DockingResult[] = [];
  const lines = content.split('\n');
  let mode = 0;

  // Regex to find: REMARK VINA RESULT:   -8.5      0.000      0.000
  const remarkRegex = /REMARK VINA RESULT:\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/;

  lines.forEach(line => {
    const match = line.match(remarkRegex);
    if (match) {
      mode++;
      results.push({
        mode: mode,
        affinity: parseFloat(match[1]),
        rmsdLb: parseFloat(match[2]),
        rmsdUb: parseFloat(match[3])
      });
    }
  });

  return results;
};

export const DockingInterface: React.FC = () => {
  // Workflow States
  const [activeStep, setActiveStep] = useState<number>(1);
  const [proteinFile, setProteinFile] = useState<File | null>(null);
  const [ligandFile, setLigandFile] = useState<File | null>(null);
  const [resultFile, setResultFile] = useState<File | null>(null); // New state for uploaded result
  const [vinaPath, setVinaPath] = useState<string>(''); // User provided local path
  const [pathError, setPathError] = useState<string>(''); // Validation error
  
  // Preparation Config
  const [prepSteps, setPrepSteps] = useState<PreparationSteps>({
    // Protein defaults
    removeWater: true,
    proteinProtonate: true,
    phLevel: 7.4,
    addForceField: true,
    forceFieldType: 'mmff94',
    
    // Ligand defaults
    ligandProtonate: true,
    ligandChargeMethod: 'gasteiger',
    ligandMinimization: true,
  });
  
  // Grid Box
  const [gridBox, setGridBox] = useState<GridBox>({
    center_x: 0, center_y: 0, center_z: 0,
    size_x: 20, size_y: 20, size_z: 20
  });

  // Docking Config (Vina Parameters)
  const [dockingConfig, setDockingConfig] = useState<DockingConfig>({
    exhaustiveness: 8,
    numModes: 9,
    energyRange: 3
  });

  // Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<DockingResult[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'protein' | 'ligand' | 'result') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (type === 'protein') setProteinFile(file);
      else if (type === 'ligand') setLigandFile(file);
      else if (type === 'result') {
        setResultFile(file);
        // Parse results immediately upon upload
        const text = await readFileContent(file);
        const parsedResults = parseVinaResult(text);
        setResults(parsedResults);
      }
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
  };

  const validatePath = (path: string) => {
    if (!path) {
        setPathError('');
        return;
    }
    
    // Check for illegal characters (common filesystem restrictions)
    // Windows illegal: < > " | ? *
    if (/[<>"|?*]/.test(path)) {
        setPathError('Path contains illegal characters (< > " | ? *)');
        return;
    }

    // Check if it looks like a directory
    if (path.endsWith('\\') || path.endsWith('/')) {
        setPathError('Path should point to the executable file (e.g., vina.exe), not a directory.');
        return;
    }

    setPathError('');
  };

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setVinaPath(val);
      validatePath(val);
  };

  const generateDockingPackage = async () => {
    if (pathError) {
        alert("Please correct the Vina executable path before downloading.");
        return;
    }

    setIsProcessing(true);
    setProcessStatus('Packaging files for Vina...');
    
    try {
        const zip = new JSZip();
        
        // Input File Names (Raw)
        const receptorRaw = "receptor_input.pdb"; // Assuming PDB input for prep
        const ligandRaw = "ligand_input.pdb";
        
        // Output File Names (Prepared)
        const receptorPrep = "receptor_prepared.pdbqt";
        const ligandPrep = "ligand_prepared.pdbqt";
        const outName = "output.pdbqt";
        const logName = "vina.log";

        // 1. Config File (Points to PREPARED files)
        const configContent = `receptor = ${receptorPrep}
ligand = ${ligandPrep}

center_x = ${gridBox.center_x}
center_y = ${gridBox.center_y}
center_z = ${gridBox.center_z}

size_x = ${gridBox.size_x}
size_y = ${gridBox.size_y}
size_z = ${gridBox.size_z}

exhaustiveness = ${dockingConfig.exhaustiveness}
num_modes = ${dockingConfig.numModes}
energy_range = ${dockingConfig.energyRange}

out = ${outName}
log = ${logName}
`;
        zip.file("config.txt", configContent);

        // 2. Input Files
        if (proteinFile) {
            const proteinText = await readFileContent(proteinFile);
            zip.file(receptorRaw, proteinText); // Save as input
        }
        
        if (ligandFile) {
             const ligandText = await readFileContent(ligandFile);
             zip.file(ligandRaw, ligandText); // Save as input
        }

        // 3. Preparation Scripts (OpenBabel)
        
        // Build OpenBabel Command for Protein
        // -d: delete water
        // -p: add hydrogens for pH
        // --minimize: minimize energy
        let obabelProt = `obabel "${receptorRaw}" -O "${receptorPrep}"`;
        if (prepSteps.removeWater) obabelProt += ` -d`;
        if (prepSteps.proteinProtonate) obabelProt += ` -p ${prepSteps.phLevel}`;
        if (prepSteps.addForceField) obabelProt += ` --minimize --ff ${prepSteps.forceFieldType}`;
        
        // Build OpenBabel Command for Ligand
        // --partialcharge: method
        // --gen3d: generate 3D coordinates if needed (optional but good)
        let obabelLig = `obabel "${ligandRaw}" -O "${ligandPrep}"`;
        if (prepSteps.ligandProtonate) obabelLig += ` -p ${prepSteps.phLevel}`;
        if (prepSteps.ligandMinimization) obabelLig += ` --gen3d`; // Often implies minimization
        obabelLig += ` --partialcharge ${prepSteps.ligandChargeMethod}`;

        const prepBat = `
@echo off
echo Running Chemical Preparation (Requires OpenBabel)...
echo Protein: ${prepSteps.forceFieldType} forcefield, pH ${prepSteps.phLevel}
echo Ligand: ${prepSteps.ligandChargeMethod} charges

REM Check for OpenBabel
where obabel >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] OpenBabel (obabel) not found in PATH.
    echo Please install OpenBabel to perform automated preparation.
    echo Defaulting to using input files as pdbqt if converted manually.
    copy "${receptorRaw}" "${receptorPrep}"
    copy "${ligandRaw}" "${ligandPrep}"
) else (
    echo Processing Receptor...
    ${obabelProt}
    echo Processing Ligand...
    ${obabelLig}
)
echo Preparation Done.
`;
        zip.file("prepare_structures.bat", prepBat);

        // 4. Main Execution Script
        const cleanPath = vinaPath.trim();
        const batContent = `
@echo off
setlocal
echo ========================================
echo      BioDock AI - AutoDock Vina Job
echo ========================================

call prepare_structures.bat

REM User Configured Executable Path
set "USER_PATH=${cleanPath}"
set "VINA_EXEC=vina"

if not "%USER_PATH%"=="" (
    if exist "%USER_PATH%" (
        set "VINA_EXEC=%USER_PATH%"
    ) else (
        echo [WARNING] User path not found: "%USER_PATH%"
        echo Falling back to 'vina' command...
    )
)

echo.
echo Starting Docking with: "%VINA_EXEC%"

"%VINA_EXEC%" --config config.txt

if %errorlevel% neq 0 (
    echo [FAILURE] Docking execution failed.
    echo Check vina.log for details.
    pause
    exit /b %errorlevel%
)

echo [SUCCESS] Docking complete! Output: output.pdbqt
pause
`;
        zip.file("run_job.bat", batContent);

        // Shell script equivalent
        const shContent = `
#!/bin/bash
echo "BioDock AI - AutoDock Vina Job"

# 1. Preparation
if command -v obabel &> /dev/null; then
    echo "Preparing structures with OpenBabel..."
    ${obabelProt.replace(/"/g, '')}
    ${obabelLig.replace(/"/g, '')}
else
    echo "[WARNING] OpenBabel not found. Please install 'openbabel' package."
    echo "Assuming inputs are already prepared PDBQTs..."
    cp ${receptorRaw} ${receptorPrep}
    cp ${ligandRaw} ${ligandPrep}
fi

# 2. Docking
VINA_EXEC="vina"
USER_PATH="${cleanPath}"

if [ ! -z "$USER_PATH" ] && [ -f "$USER_PATH" ]; then
    VINA_EXEC="$USER_PATH"
fi

echo "Running Vina..."
$VINA_EXEC --config config.txt

if [ $? -eq 0 ]; then
    echo "Docking complete: output.pdbqt"
else
    echo "Docking failed."
fi
`;
        zip.file("run_job.sh", shContent);


        // Generate Zip
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `docking_job_${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setProcessStatus('Package Ready');
        setTimeout(() => {
            setIsProcessing(false);
            setProgress(0);
            setActiveStep(4);
        }, 800);

    } catch (error) {
        console.error("Error creating zip:", error);
        setIsProcessing(false);
        alert("Failed to create docking package.");
    }
  };

  const runPreparation = () => {
    setIsProcessing(true);
    setProgress(0);
    setProcessStatus('Configuring Preparation Scripts...');
    
    // Simulation
    let step = 0;
    const interval = setInterval(() => {
        step++;
        setProgress(step * 25);
        if (step >= 4) {
            clearInterval(interval);
            setIsProcessing(false);
            setProcessStatus('Configuration Saved');
            setActiveStep(3); // Move to grid
            setProgress(0);
        }
    }, 150);
  };

  const StepIndicator = ({ num, label }: { num: number, label: string }) => (
    <div className={`flex items-center space-x-2 ${activeStep >= num ? 'text-science-500' : 'text-slate-500'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${activeStep >= num ? 'border-science-500 bg-science-500/10' : 'border-slate-600'}`}>
            {activeStep > num ? <IconCheck className="w-5 h-5" /> : <span>{num}</span>}
        </div>
        <span className="font-medium hidden md:block">{label}</span>
        {num < 4 && <div className="w-8 h-0.5 bg-slate-700 mx-2 hidden md:block" />}
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-700 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <IconAtom className="text-science-500" />
            AutoDock Vina Workflow
          </h2>
          <p className="text-slate-400 text-sm">Protocol: Prepare → Grid → Local Execution → Visualize</p>
        </div>
        <div className="flex space-x-4">
             <StepIndicator num={1} label="Input" />
             <StepIndicator num={2} label="Prepare" />
             <StepIndicator num={3} label="Grid" />
             <StepIndicator num={4} label="Run & Analyze" />
        </div>
      </div>

      {/* Step 1: Input */}
      {activeStep === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-science-500/50 transition-colors">
                <h3 className="text-lg font-semibold mb-4 text-science-100">Protein Receptor (PDB)</h3>
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-lg h-48 bg-slate-900/50">
                    <IconUpload className="w-10 h-10 text-slate-500 mb-2" />
                    <input type="file" onChange={(e) => handleFileChange(e, 'protein')} className="hidden" id="protein-upload" />
                    <label htmlFor="protein-upload" className="cursor-pointer text-science-400 hover:text-science-300 font-medium">
                        {proteinFile ? proteinFile.name : "Select PDB File"}
                    </label>
                    <p className="text-xs text-slate-500 mt-2">Target macromolecules</p>
                </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-science-500/50 transition-colors">
                <h3 className="text-lg font-semibold mb-4 text-science-100">Ligand (PDB/SDF)</h3>
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-lg h-48 bg-slate-900/50">
                    <IconUpload className="w-10 h-10 text-slate-500 mb-2" />
                    <input type="file" onChange={(e) => handleFileChange(e, 'ligand')} className="hidden" id="ligand-upload" />
                    <label htmlFor="ligand-upload" className="cursor-pointer text-science-400 hover:text-science-300 font-medium">
                         {ligandFile ? ligandFile.name : "Select File"}
                    </label>
                    <p className="text-xs text-slate-500 mt-2">Small molecules</p>
                </div>
            </div>
            
            <div className="col-span-1 md:col-span-2 flex justify-end">
                <button 
                    disabled={!proteinFile || !ligandFile}
                    onClick={() => setActiveStep(2)}
                    className="bg-science-600 hover:bg-science-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                    Proceed to Preparation <IconPlay className="w-4 h-4" />
                </button>
            </div>
        </div>
      )}

      {/* Step 2: Preparation */}
      {activeStep === 2 && (
        <div className="max-w-5xl mx-auto w-full bg-slate-800/50 border border-slate-700 rounded-xl p-8">
             <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <IconSettings className="text-science-500" />
                Structure Preparation Configuration
            </h3>
            <p className="text-slate-400 mb-6 text-sm">
                Define chemical parameters. These settings will be generated into a <code>prepare_structures</code> script (using OpenBabel) in your download package.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Protein Column */}
                <div className="space-y-6">
                    <h4 className="text-sm font-bold text-science-400 uppercase tracking-wider mb-2 border-b border-science-900/50 pb-2">Protein Receptor</h4>
                    
                    {/* Remove Water */}
                    <label className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700 cursor-pointer hover:border-science-500/50 transition">
                        <div>
                            <span className="font-medium text-slate-200 block">Remove Water</span>
                            <span className="text-xs text-slate-500">Delete HOH molecules</span>
                        </div>
                        <input type="checkbox" checked={prepSteps.removeWater} onChange={e => setPrepSteps({...prepSteps, removeWater: e.target.checked})} className="w-5 h-5 accent-science-500 rounded" />
                    </label>

                    {/* pH and Protonation */}
                    <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 space-y-3">
                         <div className="flex justify-between items-center">
                            <span className="font-medium text-slate-200">Protonate 3D</span>
                            <input type="checkbox" checked={prepSteps.proteinProtonate} onChange={e => setPrepSteps({...prepSteps, proteinProtonate: e.target.checked})} className="w-5 h-5 accent-science-500 rounded" />
                         </div>
                         {prepSteps.proteinProtonate && (
                             <div className="flex items-center gap-3 mt-2">
                                <label className="text-sm text-slate-400">Target pH:</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={prepSteps.phLevel}
                                    onChange={(e) => setPrepSteps({...prepSteps, phLevel: parseFloat(e.target.value)})}
                                    className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                                />
                                <span className="text-xs text-slate-500 italic">Adjusts amino acid states</span>
                             </div>
                         )}
                    </div>

                    {/* Force Field */}
                    <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 space-y-3">
                         <div className="flex justify-between items-center">
                            <span className="font-medium text-slate-200">Add Force Field</span>
                            <input type="checkbox" checked={prepSteps.addForceField} onChange={e => setPrepSteps({...prepSteps, addForceField: e.target.checked})} className="w-5 h-5 accent-science-500 rounded" />
                         </div>
                         {prepSteps.addForceField && (
                             <div className="mt-2">
                                <label className="block text-xs text-slate-400 mb-1">Select Force Field:</label>
                                <select 
                                    value={prepSteps.forceFieldType}
                                    onChange={(e) => setPrepSteps({...prepSteps, forceFieldType: e.target.value as any})}
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-science-500 focus:outline-none"
                                >
                                    <option value="mmff94">MMFF94 (Merck Molecular Force Field)</option>
                                    <option value="uff">UFF (Universal Force Field)</option>
                                    <option value="gaff">GAFF (General Amber Force Field)</option>
                                    <option value="ghemical">Ghemical</option>
                                </select>
                             </div>
                         )}
                    </div>
                </div>

                {/* Ligand Column */}
                <div className="space-y-6">
                    <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-2 border-b border-emerald-900/50 pb-2">Ligand</h4>
                     
                     <label className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700 cursor-pointer hover:border-emerald-500/50 transition">
                        <div>
                            <span className="font-medium text-slate-200">Energy Minimization</span>
                            <span className="text-xs text-slate-500 block">Generate 3D coordinates</span>
                        </div>
                        <input type="checkbox" checked={prepSteps.ligandMinimization} onChange={e => setPrepSteps({...prepSteps, ligandMinimization: e.target.checked})} className="w-5 h-5 accent-emerald-500 rounded" />
                    </label>

                    <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="font-medium text-slate-200">Partial Charges</span>
                            <input type="checkbox" checked={prepSteps.ligandProtonate} onChange={e => setPrepSteps({...prepSteps, ligandProtonate: e.target.checked})} className="w-5 h-5 accent-emerald-500 rounded" />
                        </div>
                        {prepSteps.ligandProtonate && (
                             <div>
                                <label className="block text-xs text-slate-400 mb-1">Calculation Method:</label>
                                <select 
                                    value={prepSteps.ligandChargeMethod}
                                    onChange={(e) => setPrepSteps({...prepSteps, ligandChargeMethod: e.target.value as any})}
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="gasteiger">Gasteiger (Standard)</option>
                                    <option value="mmff94">MMFF94 (Force Field Based)</option>
                                    <option value="qeq">QEq (Charge Equilibration)</option>
                                    <option value="qtpie">QTPIE (Charge Transfer)</option>
                                </select>
                             </div>
                         )}
                    </div>
                    
                    <div className="p-3 border border-emerald-900/30 bg-emerald-900/10 rounded text-xs text-emerald-400">
                        <strong>Auto-Save Note:</strong> Optimized files will be saved as <code>receptor_prepared.pdbqt</code> and <code>ligand_prepared.pdbqt</code> via the included script.
                    </div>
                </div>
            </div>

            {isProcessing ? (
                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <IconLoader className="w-10 h-10 text-science-500" />
                    <p className="text-science-200 animate-pulse font-mono">{processStatus}</p>
                </div>
            ) : (
                 <div className="flex justify-between">
                    <button onClick={() => setActiveStep(1)} className="text-slate-400 hover:text-white">Back</button>
                    <button 
                        onClick={runPreparation}
                        className="bg-science-600 hover:bg-science-500 text-white px-8 py-3 rounded-lg font-medium shadow-lg shadow-science-900/20"
                    >
                        Confirm Configuration & Proceed
                    </button>
                </div>
            )}
        </div>
      )}

      {/* Step 3: Grid Box */}
      {activeStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4">Grid Parameters</h3>
                    
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-sm font-medium text-science-400 mb-2">Center (Å)</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {['x', 'y', 'z'].map(axis => (
                                    <div key={`center_${axis}`}>
                                        <label className="text-xs uppercase text-slate-500 block mb-1">{axis}</label>
                                        <input 
                                            type="number" 
                                            value={gridBox[`center_${axis}` as keyof GridBox]} 
                                            onChange={(e) => setGridBox({...gridBox, [`center_${axis}`]: parseFloat(e.target.value)})}
                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-center focus:border-science-500 focus:outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium text-science-400 mb-2">Size (Å)</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {['x', 'y', 'z'].map(axis => (
                                    <div key={`size_${axis}`}>
                                        <label className="text-xs uppercase text-slate-500 block mb-1">{axis}</label>
                                        <input 
                                            type="number" 
                                            value={gridBox[`size_${axis}` as keyof GridBox]} 
                                            onChange={(e) => setGridBox({...gridBox, [`size_${axis}`]: parseFloat(e.target.value)})}
                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-center focus:border-science-500 focus:outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4">Search Parameters</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-sm text-slate-400">Exhaustiveness</label>
                            <input 
                                type="number" 
                                value={dockingConfig.exhaustiveness}
                                onChange={(e) => setDockingConfig({...dockingConfig, exhaustiveness: parseInt(e.target.value)})}
                                className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-center focus:border-science-500 focus:outline-none"
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <label className="text-sm text-slate-400">Num Modes</label>
                            <input 
                                type="number" 
                                value={dockingConfig.numModes}
                                onChange={(e) => setDockingConfig({...dockingConfig, numModes: parseInt(e.target.value)})}
                                className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-center focus:border-science-500 focus:outline-none"
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <label className="text-sm text-slate-400">Energy Range</label>
                            <input 
                                type="number" 
                                value={dockingConfig.energyRange}
                                onChange={(e) => setDockingConfig({...dockingConfig, energyRange: parseInt(e.target.value)})}
                                className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-center focus:border-science-500 focus:outline-none"
                            />
                        </div>
                    </div>
                </div>

                 <div className="space-y-3">
                    <div className="flex justify-between items-center gap-4">
                        <button onClick={() => setActiveStep(2)} className="text-slate-400 hover:text-white px-4">Back</button>
                        <button 
                            onClick={() => setActiveStep(4)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium shadow-lg flex-1 flex items-center justify-center gap-2"
                        >
                            Confirm Grid & Next
                        </button>
                    </div>
                </div>
            </div>

            {/* 3D Visualizer */}
            <div className="lg:col-span-2 h-[500px]">
                 <MolecularViewer 
                    proteinFile={proteinFile} 
                    ligandFile={ligandFile} 
                    gridBox={gridBox}
                    isProcessing={isProcessing}
                    processStatus={processStatus}
                 />
            </div>
        </div>
      )}

      {/* Step 4: Run & Analyze */}
      {activeStep === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left: Execution Instructions */}
            <div className="space-y-6">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">1. Local Execution</h3>
                    <p className="text-slate-400 text-sm mb-4">
                        Download the package. It contains a <code>run_job.bat</code> script that will first prepare structures using OpenBabel (if installed) and then run Vina.
                    </p>
                    
                    <div className="mb-4 space-y-2">
                        <label className="block text-sm font-medium text-science-400">
                            Local Vina Executable Path <span className="text-slate-500 font-normal">(Optional)</span>
                        </label>
                        <input 
                            type="text" 
                            value={vinaPath}
                            onChange={handlePathChange}
                            placeholder="e.g. C:\Program Files\Vina\vina.exe"
                            className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600 transition-colors ${
                                pathError ? 'border-red-500 focus:border-red-500' : 'border-slate-600 focus:border-science-500'
                            }`}
                        />
                         {pathError ? (
                            <p className="text-xs text-red-400 font-medium">{pathError}</p>
                        ) : (
                            <p className="text-[10px] text-slate-500">
                                Leave blank to assume 'vina' is in your system PATH.
                            </p>
                        )}
                    </div>

                    <button 
                        onClick={generateDockingPackage}
                        disabled={isProcessing}
                        className="w-full bg-science-600 hover:bg-science-500 text-white py-3 rounded-lg font-medium flex justify-center items-center gap-2 mb-4 transition-colors disabled:opacity-50"
                    >
                        {isProcessing ? <IconLoader className="w-5 h-5" /> : <IconDownload className="w-5 h-5" />}
                        Download Job Package (.zip)
                    </button>
                    
                    <div className="bg-slate-900/50 rounded p-4 text-xs font-mono text-slate-300 border border-slate-800">
                        <p className="mb-2 text-science-400"># Windows</p>
                        <p className="mb-4">&gt; Extract zip &amp; double-click "run_job.bat"</p>
                        <p className="mb-2 text-science-400"># Linux / macOS</p>
                        <p>&gt; chmod +x run_job.sh</p>
                        <p>&gt; ./run_job.sh</p>
                    </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">2. Upload Results</h3>
                    <p className="text-slate-400 text-sm mb-4">
                        After the job finishes, upload the generated <code>output.pdbqt</code> file here to visualize.
                    </p>
                    
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-lg h-32 bg-slate-900/50">
                        <IconUpload className="w-8 h-8 text-slate-500 mb-2" />
                        <input type="file" onChange={(e) => handleFileChange(e, 'result')} className="hidden" id="result-upload" />
                        <label htmlFor="result-upload" className="cursor-pointer text-emerald-400 hover:text-emerald-300 font-medium">
                            {resultFile ? resultFile.name : "Select output.pdbqt"}
                        </label>
                    </div>
                </div>
            </div>

            {/* Right: Results Table & Visualizer */}
            <div className="space-y-6">
                 {/* Visualizer with Result */}
                 <div className="h-[400px] bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
                     <MolecularViewer 
                        proteinFile={proteinFile}
                        // If we have a result file, show it instead of the input ligand
                        ligandFile={resultFile || ligandFile} 
                        gridBox={gridBox}
                        isProcessing={false}
                     />
                     <div className="absolute top-4 left-4 bg-black/50 p-2 rounded text-xs text-white">
                        {resultFile ? "Viewing: Docked Result" : "Viewing: Setup"}
                     </div>
                 </div>

                 {/* Table */}
                 {results.length > 0 && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                        <div className="p-3 bg-slate-800 border-b border-slate-700">
                            <h3 className="font-semibold text-slate-200 text-sm">Binding Affinities</h3>
                        </div>
                        <div className="overflow-x-auto max-h-64">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2">Mode</th>
                                        <th className="px-4 py-2">Affinity (kcal/mol)</th>
                                        <th className="px-4 py-2">RMSD l.b.</th>
                                        <th className="px-4 py-2">RMSD u.b.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((res) => (
                                        <tr key={res.mode} className="border-b border-slate-700 hover:bg-slate-700/50">
                                            <td className="px-4 py-2 font-mono text-science-300">{res.mode}</td>
                                            <td className="px-4 py-2 font-mono text-emerald-400 font-bold">{res.affinity.toFixed(1)}</td>
                                            <td className="px-4 py-2 font-mono text-slate-300">{res.rmsdLb.toFixed(3)}</td>
                                            <td className="px-4 py-2 font-mono text-slate-300">{res.rmsdUb.toFixed(3)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                 )}
            </div>
        </div>
      )}
    </div>
  );
};
