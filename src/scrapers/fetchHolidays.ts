import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Known NSE Trading Holidays for 2026 (YYYY-MM-DD format)
const FALLBACK_HOLIDAYS_2026 = [
    "2026-01-26", // Republic Day
    "2026-02-26", // Mahashivratri
    "2026-03-20", // Holi
    "2026-04-03", // Good Friday
    "2026-04-14", // Dr. Baba Saheb Ambedkar Jayanti
    "2026-04-21", // Ramzan Id (Id-Ul-Fitr)
    "2026-05-01", // Maharashtra Day
    "2026-08-15", // Independence Day
    "2026-09-15", // Ganesh Chaturthi
    "2026-10-02", // Mahatma Gandhi Jayanti
    "2026-10-18", // Dussehra
    "2026-11-08", // Diwali-Balipratipada
    "2026-11-24", // Gurunanak Jayanti
    "2026-12-25", // Christmas
    
    // Add today's date for user testing (reported as holiday)
    "2026-06-26" 
];

export async function fetchHolidays() {
    console.log("📅 Fetching latest NSE holidays...");
    let holidays: string[] = [];
    
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        };

        const homeRes = await axios.get('https://www.nseindia.com', { headers, timeout: 5000 });
        const cookies = homeRes.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');

        const url = 'https://www.nseindia.com/api/holiday-master?type=trading';
        const response = await axios.get(url, {
            headers: { ...headers, 'Cookie': cookies || '' },
            timeout: 5000
        });

        const data = response.data;
        const marketHolidays = data.FO || data.CM || [];
        
        holidays = marketHolidays.map((h: any) => {
            const d = new Date(h.tradingDate);
            return d.toISOString().split('T')[0];
        }).filter(Boolean);
        
        console.log(`✅ Successfully fetched holidays from NSE API.`);
    } catch (error: any) {
        console.warn(`⚠️ Failed to fetch from NSE API (${error.message}). Using fallback holidays list.`);
        holidays = FALLBACK_HOLIDAYS_2026;
    }
    
    // Save to JSON
    const dataDir = path.join(process.cwd(), 'src/data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const filepath = path.join(dataDir, 'holidays.json');
    fs.writeFileSync(filepath, JSON.stringify(holidays, null, 2));
    console.log(`✅ Saved holidays to ${filepath} with ${holidays.length} dates.`);
}

// Run if called directly
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    fetchHolidays();
}
