import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

// Opciones de "variables sin usar", compartidas por la regla de JS y la de TS
const sinUsar = {
    // _next: Express reconoce el manejador de errores por tener 4 parámetros, aunque no use el último
    argsIgnorePattern: '^_',
    // ({ total, ...fila }) => fila: total se separa a propósito para quitarlo del objeto
    ignoreRestSiblings: true,
};

export default defineConfig([
    // dist/ lo genera tsc: no se revisa
    { ignores: ['dist'] },
    js.configs.recommended,
    // process, console, crypto...: variables globales de Node, para que no salgan como "no definidas"
    { languageOptions: { globals: globals.node } },
    {
        files: ['**/*.js'],
        rules: { 'no-unused-vars': ['error', sinUsar] },
    },
    {
        // Reglas recomendadas de TypeScript, solo para .ts (los .js siguen igual)
        files: ['**/*.ts'],
        extends: [tseslint.configs.recommended],
        // En .ts la regla base se sustituye por la versión que entiende tipos
        rules: { '@typescript-eslint/no-unused-vars': ['error', sinUsar] },
    },
    // Último: apaga las reglas de formato que chocarían con Prettier
    prettier,
]);
