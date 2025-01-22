import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadContractJson(contractName) {
    return JSON.parse(
        fs.readFileSync(
            path.join(__dirname, `../../artifacts/contracts/${contractName}.sol/${contractName}.json`),
            'utf8'
        )
    );
}