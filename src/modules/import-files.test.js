import test from 'node:test';
import assert from 'node:assert/strict';
import { filesFromDrop } from './import-files.js';

function fileEntry(name) {
    return { isFile: true, name, file: (resolve) => resolve(new File(['test'], name)) };
}

function directoryEntry(...batches) {
    return {
        isDirectory: true,
        createReader() {
            return { readEntries: (resolve) => resolve(batches.shift() ?? []) };
        },
    };
}

test('reads all batches of a dropped directory, including nested Excel files', async () => {
    const directory = directoryEntry(
        [fileEntry('9001.xls'), fileEntry('omitidos.csv')],
        [directoryEntry([fileEntry('9002.XLSX')])],
    );
    const files = await filesFromDrop({
        items: [{ kind: 'file', webkitGetAsEntry: () => directory }],
        files: [],
    });

    assert.deepEqual(files.map(file => file.name), ['9001.xls', '9002.XLSX']);
});

test('imports a dropped Excel file without a directory entry', async () => {
    const file = new File(['test'], '9003.xls');
    const files = await filesFromDrop({
        items: [{ kind: 'file', getAsFile: () => file }],
        files: [],
    });

    assert.deepEqual(files, [file]);
});
