import fs from 'fs';
import path from 'path';

export function isTodayHoliday(): boolean {
    const now = new Date();
    // Convert to IST
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    const year = istTime.getFullYear();
    const month = String(istTime.getMonth() + 1).padStart(2, '0');
    const day = String(istTime.getDate()).padStart(2, '0');
    
    const todayStr = `${year}-${month}-${day}`;
    
    try {
        const filepath = path.join(process.cwd(), 'src/data/holidays.json');
        if (fs.existsSync(filepath)) {
            const holidays: string[] = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
            return holidays.includes(todayStr);
        }
    } catch (e) {
        console.error("Error reading holidays.json:", e);
    }
    
    return false;
}
