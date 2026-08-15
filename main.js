function formatNumber(num) {
        let str = num.toString();
        let parts = [];
        while (str.length > 3) {
                parts.unshift(str.slice(-3));
                str = str.slice(0, -3);
        }
        parts.unshift(str);
        return parts.join(",");
}
