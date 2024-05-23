import re

def parse_history_file(filename):
    """
    Parsea el archivo generado por 'docker history' y devuelve una lista de instrucciones Dockerfile.

    Args:
        filename (str): El nombre del archivo generado por 'docker history'.

    Returns:
        list: Una lista de instrucciones Dockerfile.
    """
    instructions = []

    with open(filename, 'r') as f:
        for line in f:
            match = re.match(r'CREATED BY: (.*)', line)
            if match:
                instruction = match.group(1).strip()
                instructions.append(instruction)

    return instructions

def generate_dockerfile(instructions, base_image=None):
    """
    Genera un Dockerfile a partir de una lista de instrucciones Dockerfile.

    Args:
        instructions (list): Una lista de instrucciones Dockerfile.
        base_image (str, opcional): La imagen base que se utilizará para construir la imagen.

    Returns:
        str: El contenido del Dockerfile.
    """
    dockerfile_content = ""

    if base_image:
        dockerfile_content += f"FROM {base_image}\n\n"

    for instruction in instructions:
        dockerfile_content += f"{instruction}\n"

    return dockerfile_content

if __name__ == "__main__":
    history_file = "dockerfile.txt"
    base_image = None  # Puedes especificar la imagen base aquí

    instructions = parse_history_file(history_file)
    dockerfile_content = generate_dockerfile(instructions, base_image)

    print(dockerfile_content)
