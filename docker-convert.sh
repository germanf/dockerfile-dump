#!/bin/bash
export LC_ALL=C.UTF-8
export LANG=C.UTF-8

# Lista de palabras clave de Dockerfile
dockerfile_keywords=(
    "FROM"
    "MAINTAINER"
    "RUN"
    "CMD"
    "LABEL"
    "EXPOSE"
    "ENV"
    "ADD"
    "COPY"
    "ENTRYPOINT"
    "VOLUME"
    "USER"
    "WORKDIR"
    "ARG"
    "ONBUILD"
    "STOPSIGNAL"
    "HEALTHCHECK"
    "SHELL"
)

# Función para verificar si una línea comienza con una palabra clave de Dockerfile
# Parámetros:
#   line: La línea de texto a verificar.
function is_filtered_line {
    local line=$1
    for keyword in "${dockerfile_keywords[@]}"; do
        if [[ "$line" == "$keyword"* ]]; then
            echo "$line"
            return 0
        fi
    done
    return 1
}

# Función para guardar el contenido en un archivo Dockerfile
# Parámetros:
#   contenido: El contenido a guardar en el archivo Dockerfile.
#   nombre: El nombre que se usará para el archivo Dockerfile.
function guardar_en_dockerfile {
    local contenido=$1
    local nombre=$2
    local nombre_archivo="Dockerfile-$nombre"
    local i=0

    echo "$contenido"

    while true; do
        if [ $i -gt 0 ]; then
            nombre_archivo="Dockerfile-$nombre-$i"
        fi
        if ! [ -e "$nombre_archivo" ]; then
            echo "$contenido" > "$nombre_archivo"
            echo "Archivo '$nombre_archivo' guardado exitosamente."
            break
        else
            read -p "El archivo '$nombre_archivo' ya existe. ¿Desea reemplazarlo? (s/n): " respuesta
            respuesta=$(echo "$respuesta" | tr '[:upper:]' '[:lower:]')
            if [ "$respuesta" == 's' ]; then
                echo "$contenido" > "$nombre_archivo"
                echo "Archivo '$nombre_archivo' reemplazado exitosamente."
                break
            elif [ "$respuesta" == 'n' ]; then
                ((i++))
            else
                echo "Respuesta no válida. Por favor, ingrese 's' para sí o 'n' para no."
            fi
        fi
    done
}

# Función para generar un Dockerfile a partir del historial de una imagen Docker
# Parámetros:
#   history: El historial de la imagen Docker.
#   base_image: La imagen base a utilizar en el Dockerfile.
function generate_dockerfile {
    local history_file=$1
    local base_image=$2
    local dockerfile_content=""
    local result=""
    local instruction

    content=$(head -n 1 "$historial_file")
    from=$(awk -v s="CREATED BY" -v h="$content" 'BEGIN{print index(h,s)}')
    to=$(awk -v s="SIZE" -v h="$content" 'BEGIN{print index(h,s)}')

    # Si se proporciona una imagen base, agregarla al Dockerfile
    if [ -n "$base_image" ]; then
        result+="FROM $base_image\n\n"
    fi

    declare -a lines=()
    # Leer el archivo línea por línea en un array
    while IFS= read -r line; do
        substr=${line:$from-1:$to-1-$from}
        # Si la línea comienza con una palabra clave de Dockerfile, agregarla al Dockerfile
        if [[ $(is_filtered_line "$substr") ]]; then
            lines+=("$substr\n")
            #lines+=("$substr")
            #lines+=$(printf "%s" '${substr}')
        fi
    done < "$history_file"

    for (( i=${#lines[@]}-1; i>=0; i-- )); do
        result+="${lines[i]}"
        # Usar printf para interpretar correctamente los códigos de escape
        #printf -v line '%b' "${lines[i]}"
        #result+="$line"
    done

    echo -e "$result" 2>&1
}

# Función para obtener el historial de una imagen Docker
# Parámetros:
#   nombre_imagen: El nombre de la imagen Docker.
function obtener_docker_history {
    local nombre_imagen=$1
    local salida
    local error
    local filename="Dockerfile-$nombre_imagen.txt"

    salida=$(docker history --no-trunc "$nombre_imagen" > "$filename" 2>&1)
    error=$?

    echo "$filename"
    return $error
}

# Función para listar las imágenes Docker
function listar_imagenes_docker {
    local salida
    local error

    salida=$(docker images 2>&1)
    error=$?

    if [ $error -ne 0 ]; then
        echo "Error al listar las imágenes Docker: $salida" >&2
        return 1
    fi

    echo "Listado de imágenes Docker:"
    echo "$salida"
}

# Función para solicitar el número de la imagen Docker
function solicitar_numero_imagen {
    local numero_imagen

    while true; do
        read -p "Ingrese el número de la imagen que desea solicitar: " numero_imagen
        if [[ "$numero_imagen" =~ ^[0-9]+$ ]]; then
            if [ "$numero_imagen" -gt 0 ]; then
                echo "$numero_imagen"
                return 0
            else
                echo "El número de imagen debe ser mayor que cero." >&2
            fi
        else
            echo "Por favor, ingrese un número entero válido." >&2
        fi
    done
}

# Función principal
function start {
    local base_image

    if [ $# -eq 0 ]; then
        listar_imagenes_docker
        numero_imagen=$(solicitar_numero_imagen + 1)
        echo "imagen seleccionada: $numero_imagen"
        imagen=$(docker images | awk 'NR=='$numero_imagen)
        base_image=$(echo "$imagen" | awk '{print $1}')
        echo "[$base_image]"
    else
        base_image=$1
    fi

    historial_file=$(obtener_docker_history "$base_image")

    dockerfile=$(generate_dockerfile "$historial_file" "$base_image")

    guardar_en_dockerfile "$dockerfile" "$base_image"
    rm -r "$historial_file"
}

start "$@"
