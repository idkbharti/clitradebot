export function getTopGainers(quotes: any, limit = 10) {
    return quotes.d
        .map((item: any) => ({
            symbol: item.v.symbol,
            name: item.v.short_name,
            changePercent: item.v.chp,
            ltp: item.v.lp,
            volume: item.v.volume,
        }))
        .sort((a: any, b: any) => b.changePercent - a.changePercent)
        .slice(0, limit);
}