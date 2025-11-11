import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "your_openai_api_key_here",
});

// System prompt for UML diagram generation
const SYSTEM_PROMPT = `Eres un experto en diagramas UML de clases. Tu tarea es generar diagramas de clases UML válidos basados en la entrada del usuario.

IMPORTANTE: Debes responder ÚNICAMENTE con un objeto JSON válido que represente el diagrama UML, sin texto adicional, sin explicaciones, sin markdown.

El formato del JSON debe ser exactamente:
{
    "elements": [
        {
            "id": "unique_id",
            "type": "class",
            "name": "ClassName",
            "attributes": [
                {
                    "name": "attributeName",
                    "type": "dataType",
                    "visibility": "public|private|protected",
                    "isPrimaryKey": false
                }
            ],
            "methods": [
                {
                    "name": "methodName",
                    "returnType": "returnType",
                    "parameters": [
                        {
                            "name": "paramName",
                            "type": "paramType"
                        }
                    ],
                    "visibility": "public|private|protected"
                }
            ],
            "position": {
                "x": 100,
                "y": 100
            }
        }
    ],
    "relationships": [
        {
            "id": "rel_unique_id",
            "type": "inheritance|composition|aggregation|association",
            "sourceId": "source_class_id",
            "targetId": "target_class_id",
            "cardinality": "1:1|1:*|*:1|*:*"
        }
    ]
}

Reglas:
1. Los IDs deben ser únicos
2. Las posiciones deben distribuirse de manera lógica (separación mínima de 200px)
3. Los tipos de datos comunes: string, int, boolean, Date, etc.
4. Visibilidades: public (+), private (-), protected (#)
5. Tipos de relaciones: inheritance, composition, aggregation, association
6. Las cardinalidades estándar: "1:1", "1:*", "*:1", "*:*"
7. NUNCA incluyas texto explicativo, solo el JSON válido`;

class AIController {
  // Generate UML diagram from text, voice, or image
  static async generateDiagram(req, res) {
    try {
      const { type, content, salaId } = req.body;
      let userInput = "";
      let responseMessage = "";

      console.log("🤖 AI Request:", { type, salaId, hasContent: !!content });

      // Check if OpenAI is configured
      if (
        !process.env.OPENAI_API_KEY ||
        process.env.OPENAI_API_KEY === "your_openai_api_key_here"
      ) {
        // Return a demo diagram
        const demoDiagram = {
          elements: [
            {
              id: "class1",
              type: "class",
              name: "Usuario",
              attributes: [
                {
                  name: "id",
                  type: "int",
                  visibility: "private",
                  isPrimaryKey: true,
                },
                {
                  name: "nombre",
                  type: "string",
                  visibility: "private",
                  isPrimaryKey: false,
                },
                {
                  name: "email",
                  type: "string",
                  visibility: "private",
                  isPrimaryKey: false,
                },
              ],
              methods: [
                {
                  name: "getNombre",
                  returnType: "string",
                  parameters: [],
                  visibility: "public",
                },
                {
                  name: "setNombre",
                  returnType: "void",
                  parameters: [{ name: "nombre", type: "string" }],
                  visibility: "public",
                },
              ],
              position: { x: 100, y: 100 },
            },
            {
              id: "class2",
              type: "class",
              name: "Proyecto",
              attributes: [
                {
                  name: "id",
                  type: "int",
                  visibility: "private",
                  isPrimaryKey: true,
                },
                {
                  name: "titulo",
                  type: "string",
                  visibility: "private",
                  isPrimaryKey: false,
                },
                {
                  name: "fechaCreacion",
                  type: "Date",
                  visibility: "private",
                  isPrimaryKey: false,
                },
              ],
              methods: [
                {
                  name: "getTitulo",
                  returnType: "string",
                  parameters: [],
                  visibility: "public",
                },
                {
                  name: "setTitulo",
                  returnType: "void",
                  parameters: [{ name: "titulo", type: "string" }],
                  visibility: "public",
                },
              ],
              position: { x: 400, y: 100 },
            },
          ],
          relationships: [
            {
              id: "rel1",
              type: "association",
              sourceId: "class1",
              targetId: "class2",
              cardinality: "1:*",
            },
          ],
        };

        return res.json({
          success: true,
          message:
            "⚠️ Demo: Configura tu clave de OpenAI para usar IA real. Diagrama de ejemplo generado.",
          diagram: demoDiagram,
          originalInput: content || "Demo input",
        });
      }

      switch (type) {
        case "text":
          userInput = content;
          responseMessage = "Diagrama generado desde texto";
          break;

        case "voice":
          // Handle audio file from FormData
          if (req.files && req.files.audio) {
            userInput = await AIController.transcribeAudio(req.files.audio[0]);
            responseMessage = `Diagrama generado desde audio: "${userInput}"`;
          } else {
            throw new Error("No se encontró archivo de audio");
          }
          break;

        case "image":
          // Handle image file from FormData
          if (req.files && req.files.image) {
            userInput = await AIController.analyzeImage(req.files.image[0]);
            responseMessage = `Diagrama generado desde imagen`;
          } else {
            throw new Error("No se encontró archivo de imagen");
          }
          break;

        default:
          throw new Error("Tipo de entrada no válido");
      }

      if (!userInput) {
        throw new Error("No se pudo procesar la entrada");
      }

      // Generate UML diagram using OpenAI
      const diagram = await AIController.generateUMLFromText(userInput);

      res.json({
        success: true,
        message: responseMessage,
        diagram: diagram,
        originalInput: userInput,
      });
    } catch (error) {
      console.error("❌ Error en AI Controller:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Error interno del servidor",
      });
    }
  }

  // Generate UML diagram using OpenAI GPT
  static async generateUMLFromText(userInput) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: `Genera un diagrama UML de clases basado en: ${userInput}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const response = completion.choices[0].message.content.trim();

      // Try to parse the JSON response
      let diagram;
      try {
        diagram = JSON.parse(response);
      } catch (parseError) {
        // If direct parsing fails, try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          diagram = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("La respuesta de AI no contiene JSON válido");
        }
      }

      // Validate the diagram structure
      AIController.validateDiagramStructure(diagram);

      return diagram;
    } catch (error) {
      console.error("Error generando diagrama UML:", error);
      throw new Error(`Error generando diagrama: ${error.message}`);
    }
  }

  // Transcribe audio using OpenAI Whisper
  static async transcribeAudio(audioFile) {
    try {
      // Save the audio file temporarily
      const tempPath = path.join(
        __dirname,
        "../../temp/",
        `audio_${Date.now()}.wav`
      );

      // Create temp directory if it doesn't exist
      const tempDir = path.dirname(tempPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(tempPath, audioFile.buffer);

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: "whisper-1",
      });

      // Clean up temp file
      fs.unlinkSync(tempPath);

      return transcription.text;
    } catch (error) {
      console.error("Error transcribiendo audio:", error);
      throw new Error(`Error transcribiendo audio: ${error.message}`);
    }
  }

  // Analyze image using OpenAI Vision
  static async analyzeImage(imageFile) {
    try {
      // Convert image to base64
      const base64Image = imageFile.buffer.toString("base64");
      const imageUrl = `data:${imageFile.mimetype};base64,${base64Image}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analiza esta imagen y describe el sistema, clases, objetos o conceptos que ves. Describe todo lo que puedas observar para crear un diagrama UML de clases.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error("Error analizando imagen:", error);
      throw new Error(`Error analizando imagen: ${error.message}`);
    }
  }

  // Validate diagram structure
  static validateDiagramStructure(diagram) {
    if (!diagram || typeof diagram !== "object") {
      throw new Error("Diagrama no es un objeto válido");
    }

    if (!Array.isArray(diagram.elements)) {
      throw new Error("El diagrama debe tener un array de elementos");
    }

    if (!Array.isArray(diagram.relationships)) {
      throw new Error("El diagrama debe tener un array de relaciones");
    }

    // Validate each element
    diagram.elements.forEach((element, index) => {
      if (!element.id || !element.type || !element.name) {
        throw new Error(
          `Elemento ${index} no tiene id, type o name requeridos`
        );
      }

      if (!Array.isArray(element.attributes)) {
        element.attributes = [];
      }

      if (!Array.isArray(element.methods)) {
        element.methods = [];
      }

      if (!element.position) {
        element.position = { x: 100 + index * 200, y: 100 };
      }
    });

    return true;
  }

  // Get available AI features
  static async getAIFeatures(req, res) {
    try {
      res.json({
        success: true,
        features: {
          textToUML: true,
          voiceToUML: true,
          imageToUML: true,
          models: ["gpt-3.5-turbo", "whisper-1", "gpt-4-vision-preview"],
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default AIController;
