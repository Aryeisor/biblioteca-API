import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    js.configs.recommended,
    // process, console, crypto...: variables globales de Node, para que no salgan como "no definidas"
    { languageOptions: { globals: globals.node } },
    {
        rules: {
            'no-unused-vars': ['error', {
                // _next: Express reconoce el manejador de errores por tener 4 parámetros, aunque no use el último
                argsIgnorePattern: '^_',
                // ({ total, ...fila }) => fila: total se separa a propósito para quitarlo del objeto
                ignoreRestSiblings: true,
            }],
        },
    },
    // Último: apaga las reglas de formato que chocarían con Prettier
    prettier,
]);
