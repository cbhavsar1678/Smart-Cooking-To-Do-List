import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client lazily
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured. Please add it in project secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Simple health endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// API endpoint to generate the Smart Cooking To-Do List and Meal Plan
app.post("/api/generate", async (req, res) => {
  const { dutyInput } = req.body;
  if (!dutyInput || typeof dutyInput !== "string") {
    res.status(400).json({ error: "dutyInput is required as a string." });
    return;
  }

  try {
    const ai = getGeminiClient();

    // Define a structured schema for consistent parsing on the frontend,
    // while ensuring it extracts everything requested in the 4 pillars.
    const prompt = `You are the expert core AI engine for the "Smart Cooking To-Do List" micro-app.
Your job is to analyze the user's specific daily duty, constraints, busy-ness, dietary preferences, or family constraints, and generate a highly structured, actionable meal plan, prepare guide, smart grocery list, and budget tier.

User Input / Duty: "${dutyInput}"

Please generate the response containing ALL of the following four pillars exactly as structured below:

1. BREAKFAST / LUNCH / DINNER PLAN:
   - Specific, realistic dishes tailored to their busy-ness and preferences.
   - For EACH meal, include:
     - Name of the meal.
     - Prep To-Do task checklist (e.g. "Chop carrots the night before", "Set crockpot at 8 AM", "Preheat oven at 6:30 PM").
     - Estimated time required to prepare the meal.

2. SMART GROCERY LIST:
   - Categorized ingredients needed for the entire meal plan (Produce, Pantry, Meat/Protein, Dairy, or other custom categories).
   - Exact or estimated quantities based on a standard serving size (default is 2 people unless specified). We want to present this as an interactive checklist.

3. INTELLIGENT SUBSTITUTIONS:
   - Provide a list of at least 3-4 smart, high-quality, practical substitutions based on dietary restrictions (like Gluten-Free, Dairy-Free, Vegan, or low-cost alternatives).
   - Each substitution should have:
     - Original ingredient
     - Replacement ingredient
     - Reason / Diet match

4. BUDGET FEASIBILITY LOGIC:
   - Classify the entire meal plan into a budget tier exactly: either "Budget-Friendly", "Moderate", or "Premium".
   - Provide a specific cost-saver tip relevant to this meal plan / ingredients used.

Format the returned JSON properties precisely according to the matching Response Schema. Do not include markdown code block formatting in the raw json schema returned.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["meals", "groceryList", "substitutions", "budget"],
          properties: {
            meals: {
              type: Type.ARRAY,
              description: "The generated meal plan, containing breakfast, lunch, and dinner.",
              items: {
                type: Type.OBJECT,
                required: ["type", "mealName", "readyTimeMinutes", "prepTodos"],
                properties: {
                  type: { type: Type.STRING, description: "Type of meal: 'Breakfast', 'Lunch', or 'Dinner'" },
                  mealName: { type: Type.STRING },
                  readyTimeMinutes: { type: Type.INTEGER, description: "Estimated active prep time in minutes" },
                  prepTodos: {
                    type: Type.ARRAY,
                    description: "Highly actionable task checklists for this meal.",
                    items: {
                      type: Type.OBJECT,
                      required: ["task", "recommendedTime"],
                      properties: {
                        task: { type: Type.STRING, description: "e.g. 'Chop peppers and onions'" },
                        recommendedTime: { type: Type.STRING, description: "e.g. 'Night before' or '8:00 AM' or '30 mins before'" }
                      }
                    }
                  }
                }
              }
            },
            groceryList: {
              type: Type.ARRAY,
              description: "The categorized grocery ingredients.",
              items: {
                type: Type.OBJECT,
                required: ["category", "items"],
                properties: {
                  category: { type: Type.STRING, description: "e.g. 'Produce', 'Pantry', 'Meat & Protein', 'Dairy', 'Bakery'" },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      required: ["name", "quantity"],
                      properties: {
                        name: { type: Type.STRING, description: "Ingredient name" },
                        quantity: { type: Type.STRING, description: "Quantity needed, e.g. '2 cups', '400g'" }
                      }
                    }
                  }
                }
              }
            },
            substitutions: {
              type: Type.ARRAY,
              description: "At least 3-4 smart substitutions based on dietary preferences or missing ingredients.",
              items: {
                type: Type.OBJECT,
                required: ["original", "replacement", "reason"],
                properties: {
                  original: { type: Type.STRING },
                  replacement: { type: Type.STRING },
                  reason: { type: Type.STRING, description: "Why make this swap, e.g. 'Gluten-Free alternative' or 'Low-cost replacement'" }
                }
              }
            },
            budget: {
              type: Type.OBJECT,
              required: ["classification", "costSaverTip"],
              properties: {
                classification: { type: Type.STRING, description: "Must be one of: 'Budget-Friendly', 'Moderate', 'Premium'" },
                costSaverTip: { type: Type.STRING, description: "Actionable tip on how to save money on this custom plan." }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    const parsed = JSON.parse(text || "{}");
    // Ensure isDemoMode is false when successful Live API runs
    res.json({ ...parsed, isDemoMode: false });
  } catch (error: any) {
    console.warn("API Call Failed. Activating premium intelligent local fallback engine. Error was:", error?.message || error);
    
    // Perform dynamic high-fidelity fallback based on user's query text
    const lowerInput = dutyInput.toLowerCase();
    let classification = "Moderate";
    let costSaverTip = "Purchase staples like grains and legumes in dry bulk weights instead of canned to slash ingredient price tags by up to 45%.";
    let meals = [];
    let groceryList = [];
    let substitutions = [];

    if (lowerInput.includes("nurse") || lowerInput.includes("night") || lowerInput.includes("shift")) {
      classification = "Moderate";
      costSaverTip = "Set up a slow-cooker with aluminum foil dividers to prep individual proteins and hot grain bases simultaneously with zero active monitoring.";
      meals = [
        {
          type: "Breakfast",
          mealName: "Warm Spiced Night-Shift Porridge",
          readyTimeMinutes: 10,
          prepTodos: [
            { task: "Measure steel-cut oats and almond milk into your jar", recommendedTime: "Night before" },
            { task: "Top with raw chia seeds and a dash of cinnamon", recommendedTime: "07:00 AM before bedtime" }
          ]
        },
        {
          type: "Lunch",
          mealName: "Double-Quota Cold-Storage Turkey Wrap",
          readyTimeMinutes: 5,
          prepTodos: [
            { task: "Pre-slice cucumber rolls and clean spinach sprouts", recommendedTime: "Morning pre-shift" },
            { task: "Layer grain tortilla with hummuses and wraps airtight", recommendedTime: "10 mins before leaving for work" }
          ]
        },
        {
          type: "Dinner",
          mealName: "Dump-and-Go Slow-Cooker Chili Verde",
          readyTimeMinutes: 15,
          prepTodos: [
            { task: "Add cubed lean pork, salsa verde, and white beans into crockpot", recommendedTime: "Before starting your 12h duty" },
            { task: "Set temperature to Low-Heat timer mode", recommendedTime: "Before departing for hospital" }
          ]
        }
      ];
      groceryList = [
        {
          category: "Fresh Produce",
          items: [
            { name: "Organic Spinach Baby Leaves", quantity: "1 bag" },
            { name: "English Cucumber", quantity: "1 count" },
            { name: "Tomatillo Salsa Verde", quantity: "1 jar" }
          ]
        },
        {
          category: "Meat & Proteins",
          items: [
            { name: "Sliced Roast Turkey Breast", quantity: "300g" },
            { name: "Lean Pork Shoulder Cubes", quantity: "450g" }
          ]
        },
        {
          category: "Packaged Pantry",
          items: [
            { name: "Steel-Cut Oats", quantity: "1 box" },
            { name: "White Tortilla Wraps", quantity: "1 pack" },
            { name: "Canned Butter beans", quantity: "1 can" }
          ]
        }
      ];
      substitutions = [
        { original: "Pork Shoulder", replacement: "Extra-Firm Silken Tofu", reason: "Satisfying vegetarian alternative with high absorption qualities" },
        { original: "Almond milk", replacement: "Warm Filtered Water & Honey", reason: "Lighter option when dairy-free alternatives are fully exhausted" },
        { original: "Turkey wraps", replacement: "Gluten-Free Tortilla Shells", reason: "Bypasses digestive gluten triggers perfectly while maintaining layout shape" }
      ];
    } else if (lowerInput.includes("teacher") || lowerInput.includes("school") || lowerInput.includes("lactose")) {
      classification = "Budget-Friendly";
      costSaverTip = "Utilize non-dairy cottage cheeses or lactose-free bulk options from wholesale counters for massive monthly dairy-free food budget savings.";
      meals = [
        {
          type: "Breakfast",
          mealName: "High-Protein Dairy-Free Chia Pudding",
          readyTimeMinutes: 12,
          prepTodos: [
            { task: "Whisk chia seeds with coconut water and lactose-free protein isolate", recommendedTime: "Night before" },
            { task: "Stir thoroughly and secure in a portable mason jar", recommendedTime: "Bedtime" }
          ]
        },
        {
          type: "Lunch",
          mealName: "The 10-Minute Schoolmaster Bento Box",
          readyTimeMinutes: 10,
          prepTodos: [
            { task: "Wash fresh baby carrots and cucumber spears", recommendedTime: "Night before" },
            { task: "Pack lactose-free cheddar blocks and smoked ham", recommendedTime: "Morning depart" }
          ]
        },
        {
          type: "Dinner",
          mealName: "Quick Skillet Garlic-Herb Shrimp",
          readyTimeMinutes: 15,
          prepTodos: [
            { task: "De-vein shrimp and dry with kitchen towels", recommendedTime: "Night before" },
            { task: "Sear on ultra-hot skillet with olive oil and garlic", recommendedTime: "20m before dinner" }
          ]
        }
      ];
      groceryList = [
        {
          category: "Produce Counters",
          items: [
            { name: "Sweet Baby Carrots", quantity: "1 bag" },
            { name: "Fresh Flat-Leaf Parsley", quantity: "1 bunch" },
            { name: "Minced Garlic Cloves", quantity: "1 jar" }
          ]
        },
        {
          category: "Proteins & Seafood",
          items: [
            { name: "Raw De-veined Shrimp", quantity: "400g" },
            { name: "Lactose-free Cheddar Blocks", quantity: "200g" },
            { name: "Sliced Lean Pit Ham", quantity: "250g" }
          ]
        },
        {
          category: "Pantry & Baking",
          items: [
            { name: "Premium Chia Seeds", quantity: "8oz" },
            { name: "Unsweetened Coconut Water", quantity: "1 liter" },
            { name: "Cold-Pressed Olive Oil", quantity: "1 bottle" }
          ]
        }
      ];
      substitutions = [
        { original: "Shrimp", replacement: "Cubed Organic Chicken Breast", reason: "Excellent low-cost protein that cooks just as rapidly in hot garlic pans" },
        { original: "Ham blocks", replacement: "Canned Smoked Tuna", reason: "Budget shelf alternative with very high micronutrient profiles" },
        { original: "Chia seeds", replacement: "Quick-Rolled Oats", reason: "Provides a denser warm breakfast texture with higher carbohydrate delivery" }
      ];
    } else if (lowerInput.includes("student") || lowerInput.includes("college") || lowerInput.includes("cheap")) {
      classification = "Budget-Friendly";
      costSaverTip = "Canned black beans and organic brown rice are complete proteins that cost under $0.50 per serving when styled with basic garlic salt.";
      meals = [
        {
          type: "Breakfast",
          mealName: "Microwave Mug-Oatmeal with Peanut Butter Duo",
          readyTimeMinutes: 5,
          prepTodos: [
            { task: "Combine quick oats and water into your favorite thermal mug", recommendedTime: "At Wakeup" },
            { task: "Stir in a massive scoop of creamy, salty peanut butter", recommendedTime: "30s before micro-heating" }
          ]
        },
        {
          type: "Lunch",
          mealName: "One-Pan Lemon Rice and Black Beans",
          readyTimeMinutes: 15,
          prepTodos: [
            { task: "Rinse long grain rice inside cold water until clear", recommendedTime: "Day before" },
            { task: "Boil with half bouillon block and toss black beans", recommendedTime: "12:30 lunchtime" }
          ]
        },
        {
          type: "Dinner",
          mealName: "Elevated Gourmet Garlic Ramen Scramble",
          readyTimeMinutes: 10,
          prepTodos: [
            { task: "Grate fresh carrots and chop green spring scallions", recommendedTime: "Day before" },
            { task: "Boil ramen noodles, drain, and stir-fry with 2 beaten eggs", recommendedTime: "06:45 PM" }
          ]
        }
      ];
      groceryList = [
        {
          category: "Fresh & Green",
          items: [
            { name: "Spring Green Scallions/Onions", quantity: "1 bunch" },
            { name: "Beta-Carotene Sweet Carrots", quantity: "2 count" }
          ]
        },
        {
          category: "Dry Goods & Grains",
          items: [
            { name: "Quick Oats", quantity: "1 cardboard container" },
            { name: "Long-Grain White Rice", quantity: "1 bag" },
            { name: "Classic Ramen Packages", quantity: "5 count" }
          ]
        },
        {
          category: "Pantry Cans",
          items: [
            { name: "Organic Black Beans", quantity: "2 cans" },
            { name: "Creamy Honey Peanut Butter", quantity: "1 jar" },
            { name: "Fresh Chicken Grade-A Eggs", quantity: "1 dozen" }
          ]
        }
      ];
      substitutions = [
        { original: "Ramen", replacement: "Thick Spaghetti Noodles", reason: "Vastly lower sodium footprint with identical structural satisfaction" },
        { original: "Eggs", replacement: "Silken Frozen Pea Puree", reason: "High storage longevity for protein binding and extra plant fiber" },
        { original: "Peanut Butter", replacement: "Sunflower Seed Butter", reason: "Completely tree-nut clean alternative for high allergen schools" }
      ];
    } else if (lowerInput.includes("keto") || lowerInput.includes("athlete") || lowerInput.includes("protein")) {
      classification = "Moderate";
      costSaverTip = "Roast chicken thighs with skin-on intact to gain healthy high-energy athletic keto fats at a fraction of dry chicken breast pricing.";
      meals = [
        {
          type: "Breakfast",
          mealName: "Athletic Avocado & Spinach Egg Scramble",
          readyTimeMinutes: 10,
          prepTodos: [
            { task: "Crack eggs into a clean shaker with sea salt", recommendedTime: "Night before" },
            { task: "Sauté baby spinach flat on butter and whisk eggs in", recommendedTime: "08:00 AM breakfast" }
          ]
        },
        {
          type: "Lunch",
          mealName: "Keto Garden Tuna-Stuffed Bell Peppers",
          readyTimeMinutes: 12,
          prepTodos: [
            { task: "Halve clean peppers and scrape hollow", recommendedTime: "Day before" },
            { task: "Fold flaky tuna salad under mayonnaise and stuff in cavity", recommendedTime: "Before departure" }
          ]
        },
        {
          type: "Dinner",
          mealName: "Crispy Cast-Iron Chicken Thigh & Broccolini",
          readyTimeMinutes: 25,
          prepTodos: [
            { task: "Pound raw skin-on chicken thighs flat and apply paprika", recommendedTime: "Late afternoon" },
            { task: "Roast broccolini inside remaining pan drippings for ultimate flavor", recommendedTime: "Dinner hour" }
          ]
        }
      ];
      groceryList = [
        {
          category: "Healthy Greens",
          items: [
            { name: "Sweet Orange Bell Peppers", quantity: "3 count" },
            { name: "Fresh Crisp Broccolini Crowns", quantity: "1 bunch" },
            { name: "Medium Haas Avocados", quantity: "2 count" }
          ]
        },
        {
          category: "Flesh Proteins",
          items: [
            { name: "Skin-On Bone-In Chicken Thighs", quantity: "650g" },
            { name: "Albocore Light Flaked Tuna", quantity: "2 cans" }
          ]
        },
        {
          category: "Larder & Dairy Fats",
          items: [
            { name: "Premium Pastured Chicken Eggs", quantity: "8 count" },
            { name: "Heavy Mayonnaise Real Whip", quantity: "1 jar" },
            { name: "Salted Sweet Cream Butter", quantity: "1 block" }
          ]
        }
      ];
      substitutions = [
        { original: "Chicken Thighs", replacement: "Pork Loin Ribs", reason: "Alternating key athletic keto proteins with high mineral indices" },
        { original: "Mayonnaise", replacement: "Double Cream Plain Greek Yogurt", reason: "Vastly increases gut microbiome bacteria while keeping low carb structures" },
        { original: "Bell Peppers", replacement: "Large Crisped Romaine Lettuce Boat", reason: "Excellent hydration crunch with zero carb concerns" }
      ];
    } else {
      // General healthy roadmap default fallback
      classification = "Moderate";
      costSaverTip = "Frozen produce items possess matching high vitamin levels to fresh alternatives, yet lower prep waste to absolute zero.";
      meals = [
        {
          type: "Breakfast",
          mealName: "CulinaPlan Power Oats with Flax",
          readyTimeMinutes: 8,
          prepTodos: [
            { task: "Measure old-fashioned oats and raw flaxseeds in bowl", recommendedTime: "Night before" },
            { task: "Pour in hot soy milk and garnish with apple honey", recommendedTime: "07:30 AM" }
          ]
        },
        {
          type: "Lunch",
          mealName: "Cozy Garden Herb Chickpea Medley",
          readyTimeMinutes: 10,
          prepTodos: [
            { task: "Drain and wash chickpeas inside mesh colander", recommendedTime: "Morning pre-work" },
            { task: "Toss with diced grape tomatoes and olive-oil dressing", recommendedTime: "12:00 lunch" }
          ]
        },
        {
          type: "Dinner",
          mealName: "Mediterranean Pan-Roasted Herb Cod",
          readyTimeMinutes: 20,
          prepTodos: [
            { task: "Thaw wild-caught cod spears under ice-water bath", recommendedTime: "Night before" },
            { task: "Place on parchment paper alongside roasted mushrooms and olives", recommendedTime: "06:30 PM dinner" }
          ]
        }
      ];
      groceryList = [
        {
          category: "Earth Produce",
          items: [
            { name: "Juicy Grape Tomatoes", quantity: "1 pack" },
            { name: "Spun Button White Mushrooms", quantity: "1 box" },
            { name: "Tangy Kalamata Olives", quantity: "1 jar" }
          ]
        },
        {
          category: "Pantry Staples",
          items: [
            { name: "Old-Fashioned Whole Oats", quantity: "1 bag" },
            { name: "Organic Dry Brown Chickpeas", quantity: "2 cans" },
            { name: "Premium Flaxseed Meal", quantity: "1 jar" }
          ]
        },
        {
          category: "Seafood Proteinst",
          items: [
            { name: "Frozen Wild-Caught Cod Fillets", quantity: "400g" },
            { name: "Low-Sodium Bouillon Cubes", quantity: "1 pack" }
          ]
        }
      ];
      substitutions = [
        { original: "Wild Cod", replacement: "Organic Firm Tofu Cubes", reason: "Excellent soy-based option that behaves exactly like flaky baked seafood" },
        { original: "Whole Oats", replacement: "Dry White Quinoa", reason: "Superb complete protein profiles with extra nutty aroma notes" },
        { original: "Flaxseeds", replacement: "Sun-Dried Pumpkin seeds", reason: "Extraordinary crunch factor that delivers magnesium in massive levels" }
      ];
    }

    // Return the response with isDemoMode = true so client knows this was simulated due to the leak exception
    res.json({
      meals,
      groceryList,
      substitutions,
      budget: {
        classification,
        costSaverTip
      },
      isDemoMode: true
    });
  }
});

// Configure Vite middleware in development or static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
