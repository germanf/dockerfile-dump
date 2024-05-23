const fs = require('fs/promises'); // Importar módulo para manejar archivos (promesas)
const { exec, execSync } = require('child_process'); // Importar métodos necesarios para ejecutar comandos
const process = require('process'); // Importar módulo para acceder a argumentos
const util = require('util');

// Definir variables constantes
const dockerfileKeywords = [
    'FROM', 'MAINTAINER', 'RUN', 'CMD', 'LABEL', 'EXPOSE', 'ENV', 'ADD', 'COPY',
    'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL',
    'HEALTHCHECK', 'SHELL'
];

const regexCreatedBy = /CREATED BY\s+(.+)/;

// Convierte exec a una función que devuelve una promesa
const execPromise = util.promisify(exec);

/**
 * Verifica si una línea comienza con una palabra clave de Dockerfile
 * @param {string} line - La línea a verificar
 * @returns {boolean} - Retorna true si la línea comienza con una palabra clave, false de lo contrario
 */
function isFilteredLine(line) {
    return dockerfileKeywords.some(keyword => line.startsWith(keyword));
}

/**
 * Extrae texto después de "CREATED BY" en una línea
 * @param {string} line - La línea de texto
 * @returns {string|null} - Retorna el texto después de "CREATED BY" o null si no hay coincidencia
 */
function getTextoDespuesDeCreatedBy(line) {
    const match = regexCreatedBy.exec(line);
    return match ? match[1].trim() : null;
}

/**
 * Guarda contenido en un archivo Dockerfile
 * @param {string} contenido - El contenido a guardar en el archivo
 * @param {string} nombre - El nombre base del archivo Dockerfile
 */
async function guardarEnDockerfile(contenido, nombre) {
    let nombreArchivo = `Dockerfile-${nombre}`;
    let i = 0;

    while (true) {
        try {
            await fs.writeFile(nombreArchivo, contenido);
            console.log(`Archivo '${nombreArchivo}' guardado exitosamente.`);
            break;
        } catch (err) {
            if (err.code === 'EEXIST') {
                const respuesta = await prompt(`El archivo '${nombreArchivo}' ya existe. ¿Desea reemplazarlo? (s/n): `);
                if (respuesta.toLowerCase() === 's') {
                    await fs.writeFile(nombreArchivo, contenido);
                    console.log(`Archivo '${nombreArchivo}' reemplazado exitosamente.`);
                    break;
                } else if (respuesta.toLowerCase() === 'n') {
                    i++;
                    nombreArchivo = `Dockerfile-${i}-${nombre}`;
                } else {
                    console.error('Respuesta no válida. Por favor, ingrese "s" para sí o "n" para no.');
                }
            } else {
                console.error(`Error al guardar el archivo: ${err.message}`);
                return;
            }
        }
    }
}

/**
 * Analiza el historial de Docker y extrae instrucciones relevantes
 * @param {string} history - El historial de Docker como una cadena
 * @returns {string[]} - Retorna un arreglo de instrucciones Dockerfile extraídas del historial
 */
function parseHistoryFile(history) {
    if (typeof history !== 'string') {
        console.error('La variable history no es una cadena, es %s', JSON.stringify(history));
        return [];
    }

    const lines = history.split('\n');
    const instructions = [];
    const idx = lines[0].indexOf('CREATED BY');
    const last = lines[0].indexOf('SIZE');

    for (const line of lines) {
        const instruction = line.substring(idx, last).trim() + '\n';
        if (isFilteredLine(instruction)) {
            instructions.push(instruction);
        }
    }

    return instructions.reverse();
}

/**
 * Genera el contenido de un Dockerfile
 * @param {string[]} instructions - Las instrucciones Dockerfile
 * @param {string|null} baseImage - La imagen base opcional
 * @returns {string} - El contenido generado del Dockerfile
 */
function generateDockerfile(instructions, baseImage = null) {
    let dockerfileContent = '';

    if (baseImage) {
        dockerfileContent += `FROM ${baseImage}\n`;
    }

    for (const instruction of instructions) {
        dockerfileContent += instruction;
    }

    return dockerfileContent;
}

/**
 * Obtiene el historial de una imagen Docker
 * @param {string} imageName - El nombre de la imagen Docker
 * @returns {Promise<string>} - Promesa que retorna el historial de la imagen Docker
 */
async function obtenerDockerHistory(imageName) {
    const command = `docker history --no-trunc ${imageName}`;
    console.log("Comando de historial: ", command);

    try {
        const { stdout, stderr } = await execPromise(command);

        if (stderr) {
            console.error(`Error al ejecutar el comando: ${stderr}`);
            return;
        }

        return stdout;
    } catch (error) {
        console.error(`Error al ejecutar el comando: ${error.message}`);
    }
}

/**
 * Lista las imágenes Docker disponibles
 * @returns {string[]} - Arreglo de líneas de la salida del comando 'docker images'
 */
async function listarImagenesDocker() {
    const command = 'docker images';

    try {
        const { error, stdout, stderr } = await execPromise(command);
        if (!stdout) {
            console.error('El número de imagen debe ser mayor que cero.');
        } else {
            return stdout;
        }
    } catch (err) {
        console.error(`Error al listar las imágenes Docker: ${err}: ${stderr}, ${error}`);
    }
}

/**
 * Solicita al usuario el número de una imagen Docker
 * @returns {Promise<number>} - Promesa que retorna el número de imagen ingresado por el usuario
 */
async function solicitarNumeroImagen() {
    while (true) {
        try {
            const numeroImagen = parseInt(await prompt('Ingrese el número de la imagen que desea solicitar: '));
            if (numeroImagen <= 0 && numeroImagen > top) {
                console.error('El número de imagen debe ser mayor que cero.');
            } else {
                return numeroImagen;
            }
        } catch (err) {
            console.error('Valor no válido. Por favor, ingrese un número entero.');
        }
    }
}

/**
 * Muestra un prompt al usuario y retorna la respuesta
 * @param {string} message - El mensaje a mostrar en el prompt
 * @returns {Promise<string>} - Promesa que retorna la respuesta del usuario
 */
function prompt(message) {
    const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(message, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

/**
 * Función principal del script
 * Realiza todo el flujo de trabajo para obtener el historial de Docker, analizarlo, y generar un Dockerfile
 */
async function start() {
    try {
        // Obtener la imagen base (de argumento o selección por usuario)
        let baseImage = process.argv[2] || null;

        if (!baseImage) {
            const imagenes = (await listarImagenesDocker()).toString();
            console.log(imagenes);
            //console.log(imagenes.substring(imagenes.indexOf("IMAGE ID"), imagenes.indexOf("CREATED")));
            const numeroImagen = await solicitarNumeroImagen();
            console.log("numero imagen %i, length %s, primer barra-n %s, cantidad de elementos %s", numeroImagen, imagenes.length, imagenes.indexOf('\n'), imagenes.toString().split('\n').length);
            //console.log("primer imagen %s", imagenes.toString().split('\n')[0]);
            const imagen = imagenes.split('\n')[numeroImagen];
            baseImage = imagen.substring(imagenes.indexOf('IMAGE ID'), imagenes.indexOf('CREATED')).trim();
            console.log(`\n[${baseImage}]\n`);
        }

        // Obtener el historial de Docker
        console.log("Obtener el historial de Docker " + baseImage);
        const history = await obtenerDockerHistory(baseImage);

        // Analizar el historial y generar el Dockerfile
        const instructions = parseHistoryFile(history);
        const dockerfileContent = generateDockerfile(instructions, baseImage);

        // Imprimir y guardar el Dockerfile
        console.log(dockerfileContent);
        await guardarEnDockerfile(dockerfileContent, baseImage);
    } catch (err) {
        console.error(err);
    }
}

// Punto de entrada del script
(async () => {
    try {
        await start();
    } catch (err) {
        if (err.name === 'KeyboardInterrupt') {
            console.log('\nScript interrumpido por el usuario.');
            // Otra acción que desees realizar al interrumpir el script
            process.exit(0);
        } else {
            console.error(err);
        }
    }
})();
