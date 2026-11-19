export function isExcelFile(file) {
    return /\.(xls|xlsx)$/i.test(file.name);
}

async function filesFromEntry(entry) {
    if (entry.isFile) {
        if (!isExcelFile(entry)) return [];
        return new Promise((resolve, reject) => entry.file(file => resolve([file]), reject));
    }
    if (!entry.isDirectory) return [];

    const reader = entry.createReader();
    const files = [];
    // readEntries can return part of a directory even when more entries remain.
    while (true) {
        const entries = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        if (!entries.length) return files;
        for (const child of entries) {
            files.push(...await filesFromEntry(child));
        }
    }
}

export async function filesFromDrop(transfer) {
    const items = Array.from(transfer.items || []).filter(item => item.kind === 'file');
    if (!items.length) return Array.from(transfer.files).filter(isExcelFile);

    // Obtain entries and files while the drop event still grants access.
    const files = await Promise.all(items.map(item => {
        const entry = item.getAsEntry?.() || item.webkitGetAsEntry?.();
        if (entry) return filesFromEntry(entry);
        const file = item.getAsFile();
        return file && isExcelFile(file) ? [file] : [];
    }));
    return files.flat();
}
