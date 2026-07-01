import fs from 'fs';
import path from 'path';
import axios from 'axios';

const SECTORS = [
    { name: "NSE:NIFTY BANK-INDEX", url: "https://archives.nseindia.com/content/indices/ind_niftybanklist.csv" },
    { name: "NSE:NIFTY IT-INDEX", url: "https://archives.nseindia.com/content/indices/ind_niftyitlist.csv" },
    { name: "NSE:NIFTY AUTO-INDEX", url: "https://archives.nseindia.com/content/indices/ind_niftyautolist.csv" },
    { name: "NSE:NIFTY METAL-INDEX", url: "https://archives.nseindia.com/content/indices/ind_niftymetallist.csv" },
    { name: "NSE:NIFTY PHARMA-INDEX", url: "https://archives.nseindia.com/content/indices/ind_niftypharmalist.csv" },
    { name: "NSE:NIFTY FMCG-INDEX", url: "https://archives.nseindia.com/content/indices/ind_niftyfmcglist.csv" },
    { name: "NSE:NIFTY ENERGY-INDEX", url: "https://archives.nseindia.com/content/indices/ind_niftyenergylist.csv" },
    { name: "NSE:NIFTY REALTY-INDEX", url: "https://archives.nseindia.com/content/indices/ind_niftyrealtylist.csv" },
    { name: "NSE:NIFTY INFRA-INDEX", url: "https://archives.nseindia.com/content/indices/ind_niftyinfralist.csv" },
    { name: "NSE:NIFTY FIN SERVICE-INDEX", url: "https://archives.nseindia.com/content/indices/ind_niftyfinancelist.csv" }
];

export async function fetchSectors() {
    console.log("📊 Fetching latest sector constituents from NSE...");
    
    const sectorData: Record<string, string[]> = {};
    
    for (const sector of SECTORS) {
        try {
            const response = await axios.get(sector.url, { timeout: 10000 });
            const csv = response.data as string;
            
            const lines = csv.split('\n').map(line => line.trim()).filter(Boolean);
            if (lines.length < 2) continue; // Headers + at least 1 stock
            
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const symbolIdx = headers.findIndex(h => h.toLowerCase() === 'symbol');
            
            if (symbolIdx === -1) {
                console.warn(`⚠️ Could not find Symbol column for ${sector.name}`);
                continue;
            }
            
            const symbols: string[] = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
                if (cols.length > symbolIdx) {
                    const sym = cols[symbolIdx];
                    if (sym) {
                        symbols.push(`NSE:${sym}-EQ`);
                    }
                }
            }
            
            sectorData[sector.name] = symbols;
            console.log(`✅ Fetched ${symbols.length} stocks for ${sector.name}`);
            
        } catch (e: any) {
            console.error(`❌ Failed to fetch ${sector.name}: ${e.message}`);
        }
    }
    
    if (Object.keys(sectorData).length > 0) {
        const dataDir = path.join(process.cwd(), 'src/data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        const filepath = path.join(dataDir, 'sectors.json');
        fs.writeFileSync(filepath, JSON.stringify(sectorData, null, 2));
        console.log(`✅ Successfully saved sector constituents to ${filepath}`);
    } else {
        console.error("❌ Failed to fetch any sector data.");
    }
}

import { fileURLToPath } from 'url';

// Run if called directly
if (import.meta.url.startsWith('file:')) {
    const modulePath = fileURLToPath(import.meta.url);
    if (process.argv[1] === modulePath) {
        fetchSectors();
    }
}
