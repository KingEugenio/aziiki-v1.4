import React, { useState } from "react";
import { Plus, Trash as Trash2, Warning as AlertTriangle, Package, Phone, User, Tag, Warehouse, CheckCircle, Truck, FileCsv as FileSpreadsheet } from "@phosphor-icons/react";
import { InventoryItem, Business } from "../types";
import EmptyState from "./errors/EmptyState";

interface InventoryManagerProps {
  currentBusiness: Business;
  inventory: InventoryItem[];
  currencySymbol: string;
  onAddInventoryItem: (item: InventoryItem) => void;
  onDeleteInventoryItem: (id: string) => void;
  onStockAdjustment: (id: string, delta: number) => void;
}

export default function InventoryManager({
  currentBusiness,
  inventory,
  currencySymbol,
  onAddInventoryItem,
  onDeleteInventoryItem,
  onStockAdjustment
}: InventoryManagerProps) {
  const [isAdding, setIsAdding] = useState<boolean>(false);
  
  // Bulk CSV States
  const [showBulkImport, setShowBulkImport] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [notif, setNotif] = useState<string | null>(null);

  // Form values
  const [name, setName] = useState<string>("");
  const [sku, setSku] = useState<string>(`SKU-${Math.floor(Math.random() * 90005) + 10000}`);
  const [quantity, setQuantity] = useState<number>(35);
  const [minStockAlert, setMinStockAlert] = useState<number>(10);
  const [unitCost, setUnitCost] = useState<number>(20);
  const [unitPrice, setUnitPrice] = useState<number>(35);
  const [supplierName, setSupplierName] = useState<string>("");
  const [supplierContact, setSupplierContact] = useState<string>("");

  const handleParseInventoryCSV = (rawText: string) => {
    try {
      const lines = rawText.split("\n");
      if (lines.length < 2) {
        setCsvError("Error: CSV must contain a header and at least one stock row!");
        return;
      }
      
      let importedCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/^"(.*)"$/, '$1').trim());
        if (cols.length < 1 || !cols[0]) continue;

        const importedName = cols[0];
        const importedSku = cols[1] || `SKU-B-${Math.floor(Math.random() * 90000) + 10000}`;
        const importedQty = Number(cols[2]) || 0;
        const importedMin = Number(cols[3]) || 5;
        const importedCost = Number(cols[4]) || 0;
        const importedPrice = Number(cols[5]) || 0;
        const importedSupplier = cols[6] || "Direct Wholesale";
        const importedContact = cols[7] || "+233...";

        onAddInventoryItem({
          id: "item-csv-" + Math.random().toString(36).substr(2, 9),
          name: importedName,
          sku: importedSku,
          quantity: importedQty,
          minStockAlert: importedMin,
          unitCost: importedCost,
          unitPrice: importedPrice,
          supplierName: importedSupplier,
          supplierContact: importedContact,
          businessId: currentBusiness.id
        });
        importedCount++;
      }

      setCsvError(null);
      setNotif(`Successfully imported ${importedCount} stock items to Warehouse!`);
      setShowBulkImport(false);
      setTimeout(() => setNotif(null), 4000);
    } catch (err: any) {
      setCsvError(`CSV Import Error: ${err.message}`);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleParseInventoryCSV(text);
      };
      reader.readAsText(file);
    } else {
      setCsvError("Error: Drop file must be a valid .csv format!");
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddInventoryItem({
      id: "item-" + Math.random().toString(36).substr(2, 9),
      name,
      sku,
      quantity,
      minStockAlert,
      unitCost,
      unitPrice,
      supplierName: supplierName || "Direct Wholesale",
      supplierContact: supplierContact || "+233 24...",
      businessId: currentBusiness.id
    });

    setName("");
    setSku(`SKU-${Math.floor(Math.random() * 90000) + 10000}`);
    setQuantity(20);
    setIsAdding(false);
  };

  const businessInventory = inventory.filter(p => p.businessId === currentBusiness.id);
  const lowStockItems = businessInventory.filter(p => p.quantity <= p.minStockAlert);

  return (
    <div id="inventory-manager-root" className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-slate-800">
      {/* Configure items left bar */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 shadow-sm shadow-emerald-500/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-sans flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-emerald-600" />
              Stock Operations
            </h3>
            <p className="text-[11px] text-slate-500 font-sans mt-0.5">
              Material controls for {currentBusiness.name}.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              id="toggle-add-stock-btn"
              onClick={() => {
                setIsAdding(!isAdding);
                setShowBulkImport(false);
              }}
              className="text-[11px] font-bold text-emerald-600 hover:text-emerald-750 font-sans flex items-center gap-1 cursor-pointer bg-slate-50 border border-slate-200 hover:border-slate-300 px-2 py-1 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" /> Acquire
            </button>
            <button
              onClick={() => {
                setShowBulkImport(!showBulkImport);
                setIsAdding(false);
              }}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-750 font-sans flex items-center gap-1 cursor-pointer bg-indigo-50 border border-indigo-120 hover:border-indigo-300 px-2 py-1 rounded-xl"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Bulk CSV
            </button>
          </div>
        </div>

        {/* Action success notifications */}
        {notif && (
          <div className="bg-emerald-50 border border-emerald-250 text-emerald-700 text-[11px] p-2.5 rounded-xl font-sans">
            ✓ {notif}
          </div>
        )}

        {/* Bulk Stock Importer */}
        {showBulkImport && (
          <div className="bg-indigo-50/40 border border-indigo-150 rounded-xl p-4 space-y-4 text-xs animate-fade-in leading-relaxed">
            <div className="flex justify-between items-center border-b border-indigo-200/30 pb-2">
              <h4 className="font-bold text-indigo-950 font-sans flex items-center gap-1">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                Bulk Import Warehouse Stock CSV
              </h4>
              <button
                onClick={() => setShowBulkImport(false)}
                aria-label="Close"
                className="text-slate-450 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-[10px] text-slate-500 leading-tight font-sans">
              Expected CSV columns or comma-separated format:<br/>
              <code className="bg-white/80 px-1 border rounded text-[9.5px] font-mono block mt-1 overflow-x-auto whitespace-nowrap">
                name, sku, quantity, minStockAlert, unitCost, unitPrice, supplierName, supplierContact
              </code>
            </p>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                dragOver 
                  ? "border-emerald-600 bg-emerald-50/50" 
                  : "border-slate-300 bg-white hover:border-slate-400"
              }`}
            >
              <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-[11px] font-medium text-slate-750">
                Drag and drop your stock_items.csv here
              </p>
              <p className="text-[9px] text-slate-450 mt-1 font-sans">
                Or click browse to pick a local .csv spreadsheet
              </p>
              
              <label className="mt-3 inline-block bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1 font-sans text-[10px] font-bold cursor-pointer">
                Browse File
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const text = event.target?.result as string;
                        handleParseInventoryCSV(text);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {csvError && (
              <p className="text-[10px] text-rose-600 font-semibold font-mono bg-rose-50 p-2 rounded-lg border border-rose-150">
                {csvError}
              </p>
            )}
          </div>
        )}

        {/* Low Stock Warning Banner */}
        {lowStockItems.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 text-rose-850 p-4 rounded-xl text-xs space-y-1.5 animate-fade-in font-sans">
            <div className="flex items-center gap-2 text-rose-600 font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>Low Stock Trigger Alert!</span>
            </div>
            <p className="text-rose-700/90 leading-relaxed font-sans">
              There are {lowStockItems.length} products with stock below threshold levels. Procure fresh materials to meet client targets.
            </p>
          </div>
        )}

        {/* Add physical item form */}
        {isAdding && (
          <form onSubmit={handleSaveItem} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs leading-relaxed">
            <h4 className="font-bold text-slate-900 font-sans">Add Product Asset</h4>
            <div>
              <label className="text-[9px] font-mono font-bold text-slate-450">Product Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 mt-1 outline-none font-sans"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-450">SKU Reference</label>
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full bg-white text-slate-800 rounded-lg px-2 py-1.5 border border-slate-200 mt-1 outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-450">Current Qty</label>
                <input
                  type="number"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full bg-white text-slate-800 rounded-lg px-2 py-1.5 border border-slate-200 mt-1 outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-455">Min Alert</label>
                <input
                  type="number"
                  required
                  value={minStockAlert}
                  onChange={(e) => setMinStockAlert(Number(e.target.value))}
                  className="w-full bg-white text-slate-800 rounded-lg px-2 py-1 border border-slate-200 mt-1 outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-455">Unit Cost</label>
                 <input
                  type="number"
                  required
                  value={unitCost}
                  onChange={(e) => setUnitCost(Number(e.target.value))}
                  className="w-full bg-white text-slate-800 rounded-lg px-2 py-1 border border-slate-200 mt-1 outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-455">Unit Price</label>
                 <input
                  type="number"
                  required
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  className="w-full bg-white text-slate-800 rounded-lg px-2 py-1 border border-slate-200 mt-1 outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-450">Supplier Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alaba Import Ltd"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full bg-white text-slate-800 rounded-lg px-2 py-1.5 border border-slate-200 mt-1 outline-none font-sans"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-450">Supplier Phone</label>
                <input
                  type="text"
                  placeholder="+234 81..."
                  value={supplierContact}
                  onChange={(e) => setSupplierContact(e.target.value)}
                  className="w-full bg-white text-slate-800 rounded-lg px-2 py-1.5 border border-slate-200 mt-1 outline-none font-sans"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 py-2.5 rounded-lg text-white font-semibold font-sans uppercase tracking-wider text-[10px] cursor-pointer mt-2"
            >
              Acquire Product
            </button>
          </form>
        )}

        <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
          Integrated inventory tracking calculates cost of goods sold (COGS) dynamically. Low-stock limits trigger real-time highlights to coordinate replenishment.
        </p>
      </div>

      {/* Main Stock Table */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm shadow-emerald-500/5">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 font-sans flex items-center gap-2 border-b border-slate-100 pb-3">
          <Warehouse className="w-4 h-4 text-emerald-600" />
          Warehouse Registry catalog
        </h4>

        {/* Catalog list layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {businessInventory.map((item) => {
            const isLowStock = item.quantity <= item.minStockAlert;

            return (
              <div 
                key={item.id} 
                className={`border rounded-xl p-4 flex flex-col justify-between font-sans text-xs relative overflow-hidden transition-all ${
                  isLowStock 
                    ? "border-rose-300 bg-rose-50/40" 
                    : "border-slate-200 bg-white hover:border-slate-350 shadow-sm shadow-emerald-500/5"
                }`}
              >
                {/* Indicators bar */}
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-slate-400 tracking-wider">SKU: {item.sku}</span>
                  {isLowStock ? (
                    <span className="text-[9px] font-mono text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">LOW STOCK</span>
                  ) : (
                    <span className="text-[9px] font-mono text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">ACTIVE STOCK</span>
                  )}
                </div>

                <div className="mt-3.5">
                  <h4 className="text-sm font-bold text-slate-900 font-sans">{item.name}</h4>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 font-sans">
                    <Truck className="w-3.5 h-3.5 text-slate-400" /> Supplier: {item.supplierName} ({item.supplierContact})
                  </p>
                </div>

                {/* Stock adjustments dials */}
                <div className="border-t border-slate-200 pt-3 mt-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 uppercase block">Active Units</span>
                    <strong className={`font-mono text-sm block mt-0.5 ${isLowStock ? "text-rose-600 font-black" : "text-slate-800 font-extrabold"}`}>
                      {item.quantity} items
                    </strong>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono">
                    <button
                      onClick={() => onStockAdjustment(item.id, -1)}
                      disabled={item.quantity <= 0}
                      className="w-7 h-7 bg-slate-50 hover:bg-slate-100 disabled:opacity-45 text-slate-700 flex items-center justify-center rounded-lg border border-slate-200 cursor-pointer text-xs"
                    >
                      -
                    </button>
                    <button
                      onClick={() => onStockAdjustment(item.id, 5)}
                      className="w-7 h-7 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center rounded-lg border border-slate-200 cursor-pointer text-xs"
                    >
                      +5
                    </button>
                    
                    <button
                      onClick={() => onDeleteInventoryItem(item.id)}
                      className="w-7 h-7 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-rose-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {businessInventory.length === 0 && (
            <div className="col-span-2">
              <EmptyState
                icon={Package}
                title="No inventory yet"
                message="Add your first product or material to start tracking stock levels and low-stock alerts."
                action={{ label: "Add a product", onClick: () => setIsAdding(true) }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
