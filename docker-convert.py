# -*- coding: utf-8 -*-
import sys
import subprocess
import re

dockerfile_keywords = [
    "FROM",
    "MAINTAINER",
    "RUN",
    "CMD",
    "LABEL",
    "EXPOSE",
    "ENV",
    "ADD",
    "COPY",
    "ENTRYPOINT",
    "VOLUME",
    "USER",
    "WORKDIR",
    "ARG",
    "ONBUILD",
    "STOPSIGNAL",
    "HEALTHCHECK",
    "SHELL"
]

def is_filtered_line(line):
    #_txt = filter(lambda x: text.find(x) != -1, dockerfile_keywords)
    #idx 
    return line if any(line.find(keyword) == 0 for keyword in dockerfile_keywords) else ""

instructions = []

# # Ejemplo de uso:
# linea_de_texto = "IMAGE CREATED              CREATED BY"
# texto_despues_created_by = obtener_texto_despues_de_created_by(linea_de_texto)
# print("Texto después de 'CREATED BY':", texto_despues_created_by)
def obtener_texto_despues_de_created_by(linea):
    # Buscar el índice de "CREATED BY" en la línea de texto
    idx = linea.find("CREATED BY")

    # Si no se encuentra "CREATED BY", retornar None
    if idx == -1:
        print('nada nada')
        return None

    # Tomar el texto que comienza después de "CREATED BY"
    texto_despues_created_by = linea[idx + len("CREATED BY"):].strip()

    return texto_despues_created_by

def guardar_en_dockerfile(contenido, name):
    # Nombre del archivo
    nombre_archivo = f"Dockerfile-{name}"
    i = 0

    # Intentar guardar en el archivo Dockerfile
    while True:
        try:
            if i > 0:
                # Intentar con nombres como Dockerfile0, Dockerfile1, etc.
                nombre_archivo = f"Dockerfile{i}-{name}"
            # Intentar abrir el archivo para escribir
            with open(nombre_archivo, "x") as archivo:
                archivo.write(contenido)
            print(f"Archivo '{nombre_archivo}' guardado exitosamente.")
            break  # Salir del bucle si se pudo guardar correctamente
        except FileExistsError:
            # Si el archivo ya existe
            respuesta = input(f"El archivo '{nombre_archivo}' ya existe. ¿Desea reemplazarlo? (s/n): ")
            if respuesta.lower() == 's':
                # Intentar abrir el archivo para escribir (sobrescribir)
                with open(nombre_archivo, "w") as archivo:
                    archivo.write(contenido)
                print(f"Archivo '{nombre_archivo}' reemplazado exitosamente.")
                break  # Salir del bucle si se pudo reemplazar correctamente
            elif respuesta.lower() == 'n':
                # Incrementar el índice para intentar con otro nombre
                i += 1
            else:
                print("Respuesta no válida. Por favor, ingrese 's' para sí o 'n' para no.")

def parse_history_file(filename):
    lines = filename.split("\n")
    instructions = []
    idx = lines[0].find("CREATED BY")
    last = lines[0].find("SIZE")
    
    # with open(filename, "r") as f:
    #     for line in f:
    #         if idx == -1:
    #             idx = line.find("CREATED BY")
    #             print(idx)
    #             last = line.find("SIZE")
    #             print(last)
    #             break

    # with open(filename, "r") as f:
        #for line in f:
    for line in lines:
        instruction = line[idx:last].strip() + "\n"
        if(is_filtered_line(instruction)):
            instructions.append(instruction)

    return instructions[::-1]

def generate_dockerfile(instructions, base_image=None):
    dockerfile_content = ""

    if base_image:
        dockerfile_content = f"FROM {base_image}" + "\n"

    for instruction in instructions:
        dockerfile_content += f"{instruction}"

    return dockerfile_content

import subprocess

def obtener_docker_history(nombre_imagen):
    # Ejecutar el comando 'docker history' y capturar la salida
    proceso = subprocess.Popen(['docker', 'history', '--no-trunc', nombre_imagen], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    salida, error = proceso.communicate()

    # Decodificar la salida a una cadena de texto
    salida_decodificada = salida.decode('utf-8')

    # Retornar la salida y el posible error
    return salida_decodificada, error

def listar_imagenes_docker():
    try:
        # Ejecutar el comando 'docker images' y capturar la salida
        proceso = subprocess.Popen(['docker', 'images'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        salida, error = proceso.communicate()

        # Decodificar la salida a una cadena de texto
        salida_decodificada = salida.decode('utf-8')

        # Separar la salida por líneas y guardarla en un array
        lineas = salida_decodificada.split('\n')

        # Imprimir la salida numerada
        print("Listado de imágenes Docker:")
        for i, linea in enumerate(lineas):
            idx = f"{i} ." if i > 0 else "   "
            print(f"{idx}{linea}")
        
        return lineas
    except Exception as e:
        print("Error al listar las imágenes Docker:", e)

def solicitar_numero_imagen():
    while True:
        try:
            numero_imagen = int(input("Ingrese el número de la imagen que desea solicitar: "))
            if numero_imagen <= 0:
                print("El número de imagen debe ser mayor que cero.")
            else:
                return numero_imagen
        except ValueError:
            print("Por favor, ingrese un número válido.")

def start():
    try:
        # Obtener el nombre de la imagen del argumento de la línea de comandos
        base_image = sys.argv[1]
    except:
        imagenes = listar_imagenes_docker()
        numero_imagen = solicitar_numero_imagen()
        imagen = imagenes[numero_imagen]
        base_image = imagen[imagenes[0].find("IMAGE"):imagenes[0].find("CREATED")].strip()
        print(f"[{base_image}] \n")
        
    # Obtener el historial de Docker y almacenar la salida en una variable
    historial, error = obtener_docker_history(base_image)

    # Imprimir la salida y manejar cualquier error
    if error:
        print("Error al obtener el historial de Docker:", error)

    instructions = parse_history_file(historial)
    dockerfile_content = generate_dockerfile(instructions, base_image)
    
    print(dockerfile_content)
    guardar_en_dockerfile(dockerfile_content, name= base_image)

if __name__ == "__main__":
    try:
        start()
    except KeyboardInterrupt:
        print("\nScript interrumpido por el usuario.")
        # Otra acción que desees realizar al interrumpir el script
        sys.exit(0)