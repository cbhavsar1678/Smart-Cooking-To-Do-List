import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Utensils, 
  CheckSquare, 
  ShoppingBag, 
  ArrowRight, 
  Zap, 
  Sparkles, 
  Clock, 
  ChevronRight, 
  TrendingDown, 
  AlertCircle, 
  RefreshCw, 
  Check, 
  Settings, 
  Printer, 
  Copy, 
  FileText, 
  HelpCircle,
  Coffee,
  Sun,
  Moon,
  Trash2,
  CalendarDays
} from "lucide-react";

// Types matching server.ts schema
interface PrepTodo {
  task: string;
  recommendedTime: string;
}

interface Meal {
  type: string; // Breakfast, Lunch, Dinner
  mealName: string;
  readyTimeMinutes: number;
  prepTodos: PrepTodo[];
}

interface GroceryItem {
  name: string;
  quantity: string;
}

interface GroceryCategory {
  category: string;
  items: GroceryItem[];
}

interface Substitution {
  original: string;
  replacement: string;
  reason: string;
}

interface BudgetConfig {
  classification: string; // Budget-Friendly, Moderate, Premium
  costSaverTip: string;
}

interface MealPlanResponse {
  meals: Meal[];
  groceryList: GroceryCategory[];
  substitutions: Substitution[];
  budget: BudgetConfig;
  isDemoMode?: boolean;
}

// Preset Duties list for immediate exploration
const DU_PRESETS = [
  {
    id: "busy-teacher",
    label: "🍎 Busy Teacher",
    description: "Extremely limited lunchtime, dairy-free/high protein packable lunch, 15 min dinners.",
    prompt: "Busy high school teacher, lactose intolerant. Needs quick, high-protein packable lunch and extremely fast 15-minute dinners with minimal cleanup."
  },
  {
    id: "wfh-parent",
    label: "🏡 WFH Parent of 2",
    description: "Budget-friendly, gluten-free, quick assembly, under 30 minutes active prep.",
    prompt: "Work-from-home parent with 2 toddlers. Meal plan must be 100% gluten-free, budget-friendly, picky-eater approved, and active prep time under 30 minutes total."
  },
  {
    id: "frugal-student",
    label: "🎓 Frugal College Student",
    description: "$10/day budget, uses 1 pan/microwave, zero culinary experience.",
    prompt: "College student on a very strict $10 per day budget. Simple 1-pan or microwave meals only, high-calorie, student dormitory friendly, using cheap stable foods."
  },
  {
    id: "keto-athlete",
    label: "💪 Keto Athlete",
    description: "Keto/low-carb, batch-cooking friendly, heavy on veggies & protein.",
    prompt: "Active athlete following a ketogenic/low-carb high-protein diet. Prefers recipe designs with high healthy fats, fresh green veggies, and easy lunch meal-preps."
  },
  {
    id: "night-nurse",
    label: "🏥 Night-Shift Nurse",
    description: "Double shift nurse with zero energy, 10 min cold assembly or slow cooker.",
    prompt: "Night-shift nurse working 12-hour shifts. Needs grab-and-go cold assemblies for nights, or crockpot/slow cooker meal set up before leaving for work."
  }
];

export default function App() {
  const [dutyInput, setDutyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlanResponse | null>(null);

  // Keep track of check lists
  const [checkedPrep, setCheckedPrep] = useState<Record<string, boolean>>({});
  const [checkedGroceries, setCheckedGroceries] = useState<Record<string, boolean>>({});

  // Tips / fun rotating messages while loading
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  const loadingTips = [
    "Chopping fresh herbs and calculating optimal meal workflow...",
    "Estimating prep-times based on your busy-ness parameters...",
    "Finding the most intelligent ingredient substitutions for your dietary criteria...",
    "Applying budget feasibility rules to minimize your grocery bill...",
    "Structuring preparation to-dos so you can cook like a professional...",
    "Calibrating macro-ingredients for standard-sized portions..."
  ];

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedPlan = localStorage.getItem("smart_cook_meal_plan");
      const savedPrep = localStorage.getItem("smart_cook_checked_prep");
      const savedGroceries = localStorage.getItem("smart_cook_checked_groceries");
      const savedInput = localStorage.getItem("smart_cook_duty_input");

      if (savedPlan) {
        setMealPlan(JSON.parse(savedPlan));
      } else {
        // Set default preview duty
        setDutyInput(DU_PRESETS[0].prompt);
      }

      if (savedPrep) setCheckedPrep(JSON.parse(savedPrep));
      if (savedGroceries) setCheckedGroceries(JSON.parse(savedGroceries));
      if (savedInput && !savedPlan) setDutyInput(savedInput);
    } catch (err) {
      console.warn("Could not load from localStorage", err);
    }
  }, []);

  // Save states to localStorage when they change
  useEffect(() => {
    if (mealPlan) {
      localStorage.setItem("smart_cook_meal_plan", JSON.stringify(mealPlan));
    } else {
      localStorage.removeItem("smart_cook_meal_plan");
    }
  }, [mealPlan]);

  useEffect(() => {
    localStorage.setItem("smart_cook_checked_prep", JSON.stringify(checkedPrep));
  }, [checkedPrep]);

  useEffect(() => {
    localStorage.setItem("smart_cook_checked_groceries", JSON.stringify(checkedGroceries));
  }, [checkedGroceries]);

  useEffect(() => {
    if (dutyInput) {
      localStorage.setItem("smart_cook_duty_input", dutyInput);
    }
  }, [dutyInput]);

  // Loading animation quote rotation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingTipIndex((prev) => (prev + 1) % loadingTips.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const generateMealPlan = async (inputStr?: string) => {
    const finalInput = inputStr || dutyInput;
    if (!finalInput.trim()) {
      setError("Please write down your daily duty schedule or select one of the presets.");
      return;
    }

    setLoading(true);
    setError(null);
    // Clear old check states to start fresh on a new meal plan
    setCheckedPrep({});
    setCheckedGroceries({});

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dutyInput: finalInput }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Generation endpoint returned unhealthy response");
      }

      const data: MealPlanResponse = await response.json();
      setMealPlan(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "There was an error communicating with the Gemini helper on the server.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (promptText: string) => {
    setDutyInput(promptText);
    generateMealPlan(promptText);
  };

  const clearCurrentPlan = () => {
    setMealPlan(null);
    setCheckedPrep({});
    setCheckedGroceries({});
    setDutyInput("");
    localStorage.removeItem("smart_cook_meal_plan");
    localStorage.removeItem("smart_cook_checked_prep");
    localStorage.removeItem("smart_cook_checked_groceries");
  };

  const togglePrepTask = (mealIdx: number, taskIdx: number) => {
    const key = `${mealIdx}-${taskIdx}`;
    setCheckedPrep((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleGroceryItem = (catIdx: number, itemIdx: number) => {
    const key = `${catIdx}-${itemIdx}`;
    setCheckedGroceries((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Calculations for progress metrics
  const totalPrepTasks = mealPlan?.meals.reduce((acc, meal) => acc + meal.prepTodos.length, 0) || 0;
  const completedPrepTasks = Object.keys(checkedPrep).filter((key) => {
    const [mStr, tStr] = key.split("-");
    const mIdx = parseInt(mStr);
    const tIdx = parseInt(tStr);
    const mealExists = mealPlan?.meals[mIdx];
    const taskExists = mealExists?.prepTodos[tIdx];
    return taskExists && checkedPrep[key];
  }).length;

  const totalGroceryItems = mealPlan?.groceryList.reduce((acc, cat) => acc + cat.items.length, 0) || 0;
  const completedGroceryItems = Object.keys(checkedGroceries).filter((key) => {
    const [cStr, iStr] = key.split("-");
    const cIdx = parseInt(cStr);
    const iIdx = parseInt(iStr);
    const catExists = mealPlan?.groceryList[cIdx];
    const itemExists = catExists?.items[iIdx];
    return itemExists && checkedGroceries[key];
  }).length;

  const prepProgress = totalPrepTasks > 0 ? Math.round((completedPrepTasks / totalPrepTasks) * 100) : 0;
  const groceryProgress = totalGroceryItems > 0 ? Math.round((completedGroceryItems / totalGroceryItems) * 100) : 0;

  // Render budget color styles based on classification
  const getBudgetStyle = (tier: string) => {
    const normalized = (tier || "").toLowerCase();
    if (normalized.includes("budget") || normalized.includes("friendly") || normalized.includes("low")) {
      return {
        bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
        pill: "bg-emerald-500",
        badge: "Budget-Friendly",
        iconStyle: "text-emerald-600"
      };
    } else if (normalized.includes("moderate") || normalized.includes("medium")) {
      return {
        bg: "bg-amber-50 text-amber-800 border-amber-200",
        pill: "bg-amber-500",
        badge: "Moderate",
        iconStyle: "text-amber-600"
      };
    } else {
      return {
        bg: "bg-indigo-50 text-indigo-800 border-indigo-200",
        pill: "bg-indigo-500",
        badge: "Premium Price Tier",
        iconStyle: "text-indigo-600"
      };
    }
  };

  const copyAsMarkdown = () => {
    if (!mealPlan) return;

    let md = `# Smart Cooking Plan & To-Do List - Budget Tier: ${mealPlan.budget.classification}\n\n`;
    
    md += `## 🍽️ MEAL PLAN & PREPARATION CHECKLIST\n\n`;
    mealPlan.meals.forEach((meal) => {
      md += `### ${meal.type.toUpperCase()}: ${meal.mealName} (Ready in ${meal.readyTimeMinutes}m)\n`;
      meal.prepTodos.forEach((todo) => {
        md += `- [ ] ${todo.task} (${todo.recommendedTime})\n`;
      });
      md += `\n`;
    });

    md += `## 🛒 SMART GROCERY SHOPPING LIST\n\n`;
    mealPlan.groceryList.forEach((cat) => {
      md += `### ${cat.category}\n`;
      cat.items.forEach((item) => {
        md += `- [ ] ${item.name} - ${item.quantity}\n`;
      });
      md += `\n`;
    });

    md += `## 🔄 INTELLIGENT SUBSTITUTIONS\n\n`;
    mealPlan.substitutions.forEach((sub) => {
      md += `- Swap **${sub.original}** for **${sub.replacement}** (Reason: ${sub.reason})\n`;
    });
    md += `\n`;

    md += `## 💰 BUDGET FEASIBILITY & MONEY SAVER TIP\n`;
    md += `- **Cost-Saver Tip**: ${mealPlan.budget.costSaverTip}\n`;

    navigator.clipboard.writeText(md);
    alert("Meal Plan copied to clipboard as beautifully formatted Markdown!");
  };

  const triggerPrint = () => {
    const activeTitle = `CulinaPlan_${mealPlan?.budget?.classification || "Meal"}_Prep_Plan`;
    const originalTitle = document.title;
    try {
      document.title = activeTitle.replace(/\s+/g, "_");
    } catch (e) {
      console.warn("Could not change document title temporarily:", e);
    }
    
    window.focus();
    window.print();

    setTimeout(() => {
      try {
        document.title = originalTitle;
      } catch (e) {}
    }, 150);
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2] print:bg-white font-sans text-[#333333] leading-relaxed py-8 px-4 md:px-8 relative overflow-x-hidden print:py-0 print:px-0">
      
      {/* Decorative background grid subtle accent matching natural sand tones */}
      <div className="absolute inset-0 bg-[radial-gradient(#ede9e0_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none opacity-60 print:hidden"></div>

      <div className="max-w-6xl mx-auto h-full flex flex-col relative z-10 print:max-w-none print:w-full">
        
        {/* CulinaPlan AI Design Theme Premium Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#e5e0d5] pb-6 mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5a5a40] text-white rounded-full flex items-center justify-center shadow-xs">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h1 id="app-title" className="text-2xl font-serif italic text-[#5a5a40] font-bold">
                CulinaPlan AI
              </h1>
              <p className="text-[10px] text-[#999999] tracking-widest uppercase font-semibold font-mono">
                Smart Cooking To-Do List & Preparation Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <span className="text-[11px] px-3 py-1 font-semibold bg-[#f0ede6] text-[#5a5a40] rounded-full border border-[#ede9e0] select-none">
              Gemini 3.5 Flash Active Agent
            </span>
            <span className="text-[11px] px-3 py-1 font-semibold bg-[#fcfaf7] text-[#c16646] rounded-full border border-[#ede9e0] select-none flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c16646] animate-pulse"></span>
              2 Portions Standard Scale
            </span>
          </div>
        </header>

        {/* Outer Layout Split layout structured specifically to highlight CulinaPlan visual rhythms */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start print:flex print:flex-col print:gap-6 print:p-0">
          
          {/* LEFT PANEL: INPUT GENERATOR & PRESETS (lg:span-4 or span-5) */}
          <section className="lg:col-span-4 flex flex-col gap-6 print:hidden">
            
            {/* Input card with cozy border style */}
            <div id="duty-input-card" className="bg-white rounded-[24px] border border-[#ede9e0] shadow-xs p-5 md:p-6">
              
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-[#5a5a40]" />
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#5a5a40]">Define Your Daily Duty</h2>
              </div>
              
              <p className="text-stone-500 text-xs mb-3">
                Specify your custom timeframe, busy-ness index, family parameters, dietary rules, or dynamic pantry boundaries.
              </p>

              <textarea
                id="duty-input-area"
                className="w-full text-sm p-4 bg-[#fdfbf7] border border-[#ede9e0] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#5a5a40] focus:border-[#5a5a40] transition duration-155 resize-y min-h-[140px] font-sans placeholder:text-stone-400"
                placeholder="E.g., Busy shift nurse, extremely tired. Gluten-free, needs high-energy packable snacks for active duty, $15 total food budget."
                value={dutyInput}
                onChange={(e) => setDutyInput(e.target.value)}
              />

              <div className="mt-4 flex flex-col gap-2">
                <button
                  id="btn-generate"
                  onClick={() => generateMealPlan()}
                  disabled={loading || !dutyInput.trim()}
                  className="w-full bg-[#c16646] hover:bg-[#b05537] text-white font-semibold text-xs py-3.5 px-4 rounded-full flex items-center justify-center gap-2 transition cursor-pointer disabled:bg-[#f0ede6] disabled:text-stone-400 disabled:cursor-not-allowed shadow-xs"
                >
                  {loading ? (
                    <>
                      <RotateLoader />
                      <span>Composing Actionable Plan...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Actionable Checklist</span>
                    </>
                  )}
                </button>

                {mealPlan && (
                  <button
                    onClick={clearCurrentPlan}
                    className="w-full hover:bg-[#f0ede6] text-[#5a5a40] font-semibold text-xs py-2 rounded-full flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset Current Checklist</span>
                  </button>
                )}
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50/90 border border-red-200 rounded-[20px] text-xs text-red-800 flex flex-col gap-3 animate-fadeIn">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-red-950">System Configuration Required</span>
                      <span className="leading-relaxed text-red-900">{error}</span>
                    </div>
                  </div>
                  {(error.toLowerCase().includes("gemini_api_key") || error.toLowerCase().includes("api key") || error.toLowerCase().includes("leaked")) && (
                    <div className="bg-white/70 p-3 rounded-xl border border-red-200/50 flex flex-col gap-1.5 text-[11px] text-stone-700">
                      <span className="font-semibold text-stone-900 uppercase tracking-wider text-[9px] block">How to configure your app:</span>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Locate the <span className="font-semibold">Secrets panel</span> (accessible on the top toolbar or gear icon symbol).</li>
                        <li>Update or re-insert <span className="font-semibold text-[#c16646]">GEMINI_API_KEY</span>.</li>
                        <li>Re-run the meal planner check to test connection.</li>
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Presets Card for Quick Testing */}
            <div id="presets-card" className="bg-white rounded-[24px] border border-[#ede9e0] shadow-xs p-5 md:p-6">
              
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4.5 h-4.5 text-[#5a5a40]" />
                <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-[#5a5a40]">Quick-Load Preset Duties</h3>
              </div>

              <div className="flex flex-col gap-2">
                {DU_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.prompt)}
                    className={`w-full text-left p-3.5 rounded-xl border text-xs transition relative overflow-hidden flex flex-col gap-1 cursor-pointer group ${
                      dutyInput === preset.prompt 
                        ? "bg-[#5a5a40] text-white border-[#5a5a40]" 
                        : "bg-white hover:bg-[#fdfbf7] text-stone-800 border-[#ede9e0]"
                    }`}
                  >
                    <div className="font-semibold flex items-center justify-between">
                      <span className="font-serif italic text-sm">{preset.label}</span>
                      <ChevronRight className={`w-3.5 h-3.5 transition group-hover:translate-x-0.5 ${dutyInput === preset.prompt ? "text-stone-300" : "text-stone-400"}`} />
                    </div>
                    <span className={`text-[11px] leading-tight ${dutyInput === preset.prompt ? "text-stone-200" : "text-stone-500"}`}>
                      {preset.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Micro-App Focus Note */}
            <div className="p-4.5 bg-[#fdfbf7] rounded-[20px] border border-[#ede9e0] text-xs text-[#5a5a40] flex flex-col gap-2 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-[#5a5a40] uppercase tracking-wider text-[11px]">
                <Zap className="w-4 h-4 text-[#c16646]" />
                <span>Smart Culinary Logic</span>
              </div>
              <p className="leading-relaxed text-[11px] text-stone-600">
                This cozy layout synchronizes active grocery schedules directly with dynamic prep milestones inside clean checkable elements.
              </p>
            </div>

          </section>

          {/* RIGHT PANEL: OUTPUT DETAILS (lg:col-span-8) */}
          <section className="lg:col-span-8 print:col-span-12 print:w-full flex flex-col gap-6">

            <AnimatePresence mode="wait">
              {loading ? (
                /* Interactive Loading Panel */
                <motion.div
                  key="loading-panel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white rounded-[32px] border border-[#ede9e0] shadow-sm p-8 text-center flex flex-col items-center justify-center min-h-[500px]"
                >
                  <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-full border-4 border-[#f0ede6] border-t-[#5a5a40] animate-spin flex items-center justify-center">
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-[#c16646] animate-pulse" />
                    </div>
                  </div>

                  <h3 className="text-lg font-serif italic font-bold text-[#5a5a40] mb-2">Analyzing your Duty Plan...</h3>
                  <p className="text-stone-500 text-xs max-w-sm mb-6 leading-relaxed">
                    Custom meal routines are configured in standard 2-person units with strict prep guidelines generated to streamline active schedules.
                  </p>

                  <div className="w-full max-w-xs h-1 bg-[#f0ede6] rounded-full overflow-hidden mb-4">
                    <motion.div 
                      className="h-full bg-[#5a5a40]" 
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 15, ease: "easeInOut" }}
                    />
                  </div>

                  <div className="text-[10px] font-mono text-[#c16646] uppercase tracking-widest px-4 py-1.5 bg-[#fcfaf7] border border-[#ede9e0] rounded-full">
                    {loadingTips[loadingTipIndex]}
                  </div>
                </motion.div>
              ) : mealPlan ? (
                /* Loaded Meal Plan & Checklist Screen */
                <motion.div
                  key="mealplan-panel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-6"
                >
                  {mealPlan.isDemoMode && (
                    <div className="bg-amber-50/80 border border-amber-200/80 rounded-[24px] p-5 text-xs text-amber-900 flex flex-col gap-2.5 animate-fadeIn print:hidden">
                      <div className="flex items-start gap-2.5">
                        <Sparkles className="w-5 h-5 text-[#c16646] shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-amber-950 font-serif italic text-sm">CulinaPlan AI Fallback Mode Active</span>
                          <span className="leading-relaxed">
                            Your workspace's Gemini API Key has been flagged as leaked by Google Cloud. To protect your billing and quota, CulinaPlan has automatically activated its <strong className="text-[#c16646]">Offline Intelligent Prep Engine</strong>.
                          </span>
                        </div>
                      </div>
                      <p className="pl-7 text-[11px] text-amber-800 leading-relaxed border-t border-amber-200/50 pt-2">
                        You can continue writing custom schedules, food preferences, or testing all preset duties! CulinaPlan will immediately compose custom structured preparation lists, grocery tallies, and money-saving rules locally using its rich dynamic recipes.
                      </p>
                    </div>
                  )}

                  {/* Performance Indicators & Export Actions */}
                  <div className="bg-white rounded-[24px] border border-[#ede9e0] shadow-xs p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-6 w-full md:w-auto">
                      
                      {/* Prep Work completed progress */}
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 flex items-center justify-center bg-[#fdfbf7] rounded-full border border-[#ede9e0]">
                          <CheckSquare className="w-5 h-5 text-[#5a5a40]" />
                          <div className={`absolute -top-1 -right-1 w-5 h-5 ${prepProgress === 100 ? "bg-[#c16646]" : "bg-[#5a5a40]"} text-white font-mono text-[9px] font-semibold rounded-full flex items-center justify-center border border-white shadow-xs`}>
                            {prepProgress}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">Prep Roadmaps</div>
                          <div className="text-xs font-semibold text-stone-800">
                            {completedPrepTasks} of {totalPrepTasks} chores done
                          </div>
                        </div>
                      </div>

                      {/* Grocery Progress */}
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 flex items-center justify-center bg-[#fdfbf7] rounded-full border border-[#ede9e0]">
                          <ShoppingBag className="w-5 h-5 text-[#5a5a40]" />
                          <div className={`absolute -top-1 -right-1 w-5 h-5 ${groceryProgress === 100 ? "bg-[#c16646]" : "bg-[#5a5a40]"} text-white font-mono text-[9px] font-semibold rounded-full flex items-center justify-center border border-white shadow-xs`}>
                             {groceryProgress}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono text-stone-400 uppercase tracking-wider font-semibold">Groceries Bought</div>
                          <div className="text-xs font-semibold text-stone-800">
                            {completedGroceryItems} of {totalGroceryItems} gathered
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Export / Sync Action buttons */}
                    <div className="flex items-center gap-2 justify-end w-full md:w-auto border-t md:border-t-0 border-[#ede9e0] pt-3 md:pt-0 print:hidden">
                      <button
                        onClick={copyAsMarkdown}
                        className="px-3.5 py-2 bg-[#f0ede6] hover:bg-[#e5e0d5] transition text-[#5a5a40] rounded-full text-xs font-medium flex items-center gap-1.5 cursor-pointer border border-[#ede9e0]/60"
                        title="Copy as Markdown Plan"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Plan</span>
                      </button>

                      <button
                        onClick={triggerPrint}
                        className="px-4 py-2 bg-[#5a5a40] hover:bg-[#4c4c36] transition text-white rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm border border-[#5a5a40]/30"
                        title="Print Meal Guide or Save as PDF"
                      >
                        <Printer className="w-4 h-4 text-white" />
                        <span>Print &amp; Download PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* PILLAR 4: BUDGET FEASIBILITY & FEASIBLE BAR */}
                  <div className="bg-[#5a5a40] text-white rounded-[24px] p-6 shadow-xs flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="w-4 h-4 text-[#ede9e0]" />
                          <p className="text-[10px] uppercase tracking-widest text-[#ede9e0] font-semibold font-mono">Pillar 4: Budget Feasibility Assessment</p>
                        </div>
                        <span className="text-[10px] font-bold bg-white/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider text-white">
                          Tier: {mealPlan.budget.classification}
                        </span>
                      </div>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl border border-white/10">
                      <p className="text-[10px] font-bold uppercase opacity-90 tracking-widest text-[#f8f6f2] mb-1">Cost-Saver Recipe Tip</p>
                      <p className="text-xs sm:text-sm italic leading-relaxed text-[#f8f6f2] select-all font-serif">
                        &ldquo;{mealPlan.budget.costSaverTip}&ldquo;
                      </p>
                    </div>
                  </div>

                  {/* PILLAR 1: BREAKFAST / LUNCH / DINNER & MEAL ACTIONABLES */}
                  <div id="meal-plan-section" className="bg-white rounded-[24px] border border-[#ede9e0] shadow-sm p-5 md:p-6">
                    <div className="flex items-center justify-between mb-4 border-b border-[#f0ede6] pb-3">
                      <div className="flex items-center gap-2">
                        <Utensils className="w-4.5 h-4.5 text-[#5a5a40]" />
                        <h2 className="text-xs uppercase tracking-[0.2em] text-[#5a5a40] font-bold">Pillar 1: Daily Roadmaps</h2>
                      </div>
                      <span className="text-xs text-stone-400 italic">Expected Daily Prep Chore Tasks</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {mealPlan.meals.map((meal, mealIdx) => {
                        const mealTypeIcon = (type: string) => {
                          const val = type.toLowerCase();
                          if (val.includes("break")) return <Coffee className="w-4 h-4 text-[#c16646]" />;
                          if (val.includes("lunch")) return <Sun className="w-4 h-4 text-[#5a5a40]" />;
                          return <Moon className="w-4 h-4 text-amber-850" />;
                        };

                        return (
                          <div key={mealIdx} className="flex flex-col bg-white border border-[#ede9e0] rounded-[20px] p-5 shadow-2xs group relative hover:shadow-xs transition">
                            
                            {/* Meal Heading */}
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <span className="text-[10px] uppercase font-bold text-[#5a5a40] bg-[#f0ede6] px-2.5 py-0.5 rounded-full">
                                {meal.type}
                              </span>
                              <span className="text-[10px] font-mono text-[#999999] flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {meal.readyTimeMinutes} min active
                              </span>
                            </div>

                            <h4 className="text-base font-serif font-bold text-[#5a5a40] mb-2 leading-tight group-hover:text-[#c16646] transition duration-150">
                              {meal.mealName}
                            </h4>

                            {/* Prep To Do List specific to this meal */}
                            <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-[#ede9e0]/60 bg-[#fdfbf7] p-3 rounded-xl border-l-4 border-[#5a5a40]">
                              <span className="text-[10px] font-bold uppercase text-[#5a5a40] tracking-wider mb-1 block">Prep To-Do List</span>
                              {meal.prepTodos.map((todo, taskIdx) => {
                                const key = `${mealIdx}-${taskIdx}`;
                                const isChecked = !!checkedPrep[key];

                                return (
                                  <label
                                    key={taskIdx}
                                    className={`flex items-start gap-2 cursor-pointer p-1 rounded-lg transition-colors select-none ${
                                      isChecked 
                                        ? "bg-transparent opacity-60" 
                                        : "hover:bg-white"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="sr-only"
                                      checked={isChecked}
                                      onChange={() => togglePrepTask(mealIdx, taskIdx)}
                                    />
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all mt-0.5 ${
                                      isChecked 
                                        ? "border-[#5a5a40] bg-[#5a5a40] text-white" 
                                        : "border-[#ccc] bg-white"
                                    }`}>
                                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                    <div className="flex flex-col leading-tight">
                                      <span className={`text-[11px] font-medium ${isChecked ? "text-[#999999] line-through" : "text-[#444444]"}`}>
                                        {todo.task}
                                      </span>
                                      <span className="text-[9px] font-mono text-[#999999] block mt-0.5">
                                        ⏱️ Expected: {todo.recommendedTime}
                                      </span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* PILLAR 2: SMART GROCERY LIST */}
                    <div id="grocery-list-section" className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-[#ede9e0] flex flex-col">
                      <div className="flex items-center justify-between mb-6 border-b border-[#f0ede6] pb-3">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4.5 h-4.5 text-[#5a5a40]" />
                          <h2 className="text-xs uppercase tracking-[0.2em] text-[#5a5a40] font-bold">Pillar 2: Smart Grocery List</h2>
                        </div>
                        <span className="text-[10px] font-mono font-semibold text-[#5a5a40] px-2.5 py-0.5 bg-[#f0ede6] rounded-full">
                          Standard 2 Servings Scale
                        </span>
                      </div>

                      <div className="flex flex-col gap-6 overflow-y-auto max-h-[420px] pr-1 print:max-h-none print:overflow-visible">
                        {mealPlan.groceryList.map((categoryObj, catIdx) => (
                          <div key={catIdx} className="flex flex-col gap-2">
                            <span className="text-[11px] font-bold text-[#c16646] uppercase border-b border-[#f0ede6] pb-1 tracking-[0.15em] self-start inline-block">
                              {categoryObj.category}
                            </span>
                            <div className="grid grid-cols-1 gap-1.5 pl-1">
                              {categoryObj.items.map((item, itemIdx) => {
                                const key = `${catIdx}-${itemIdx}`;
                                const isChecked = !!checkedGroceries[key];

                                return (
                                  <label
                                    key={itemIdx}
                                    className={`flex items-center justify-between gap-3 cursor-pointer p-2.5 rounded-xl transition-all border ${
                                      isChecked 
                                        ? "bg-[#fdfbf7] text-stone-400 border-[#ede9e0]" 
                                        : "bg-white hover:bg-[#fdfbf7] border-[#ede9e0] hover:border-[#5a5a40]/30"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={isChecked}
                                        onChange={() => toggleGroceryItem(catIdx, itemIdx)}
                                      />
                                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                        isChecked 
                                          ? "border-[#5a5a40] bg-[#5a5a40] text-white" 
                                          : "border-[#ccc] bg-white"
                                      }`}>
                                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                      </div>
                                      <span className={`text-[12px] font-medium leading-normal ${isChecked ? "line-through text-stone-400" : "text-[#444444]"}`}>
                                        {item.name}
                                      </span>
                                    </div>
                                    <span className="text-[11px] font-mono text-[#5a5a40] bg-[#f0ede6] px-2.5 py-0.5 rounded-full select-none">
                                      {item.quantity}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* PILLAR 3: INTELLIGENT SUBSTITUTIONS */}
                    <div id="substitutions-section" className="bg-white rounded-[24px] p-5 md:p-6 shadow-sm border border-[#ede9e0] flex flex-col">
                      <div className="flex items-center gap-2 mb-4 border-b border-[#f0ede6] pb-3">
                        <RefreshCw className="w-4.5 h-4.5 text-[#5a5a40]" />
                        <h2 className="text-xs uppercase tracking-[0.2em] text-[#5a5a40] font-bold">Pillar 3: Smart Substitutions</h2>
                      </div>

                      <p className="text-stone-500 text-xs mb-4 leading-relaxed">
                        Handy ingredient switch-ups to easily bypass food allergies or leverage missing pantry candidates.
                      </p>

                      <div className="flex flex-col gap-3 overflow-y-auto max-h-[420px] pr-1 print:max-h-none print:overflow-visible">
                        {mealPlan.substitutions.map((sub, index) => (
                          <div key={index} className="p-4 bg-[#fdfbf7] hover:bg-white rounded-xl border border-[#ede9e0]/85 flex flex-col gap-2 transition shadow-3xs">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Original</span>
                                <span className="text-xs font-bold text-[#c16646] bg-white border border-[#ede9e0] px-2 py-0.5 rounded-md">
                                  {sub.original}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-widest mr-1">👉 Swap</span>
                                <span className="text-xs font-bold text-[#5a5a40] bg-[#f0ede6] border border-[#ede9e0] px-2 py-0.5 rounded-md">
                                  {sub.replacement}
                                </span>
                              </div>
                            </div>

                            <div className="text-[11px] text-stone-600 font-serif italic border-t border-[#ede9e0]/40 pt-2 flex items-start gap-1.5 leading-normal">
                              <Sparkles className="w-3.5 h-3.5 text-[#c16646] shrink-0 mt-0.5" />
                              <span>{sub.reason}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                </motion.div>
              ) : (
                /* Landing state / empty view */
                <motion.div
                  key="empty-panel"
                  className="bg-white rounded-[32px] border border-[#ede9e0] p-8 md:p-12 text-center flex flex-col items-center justify-center min-h-[450px]"
                >
                  <div className="w-16 h-16 rounded-full bg-[#f0ede6] text-[#5a5a40] flex items-center justify-center mb-6 border border-[#ede9e0]/70">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h3 id="landing-title" className="text-2xl font-serif italic font-bold text-[#5a5a40] tracking-tight">Your Custom Culinary Checklist awaits</h3>
                  <p className="text-stone-500 text-xs max-w-sm mt-2 mb-6">
                    Enter a dynamic description of your duties, working constraints, or diet rules on the left to instantly build standard 2-person meal roadmaps.
                  </p>
                  
                  <div className="text-xs font-mono text-stone-400 mt-4 border-t border-stone-100 pt-4 w-full max-w-xs justify-center flex items-center gap-2">
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Real-Time Checkable Todo engine</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </section>

        </main>

        <footer className="mt-16 text-center text-xs text-[#999999] border-t border-[#e5e0d5] pt-6 font-mono tracking-wide pb-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>&copy; {new Date().getFullYear()} CulinaPlan AI &bull; Smart Cooking Guide</span>
          <span>Double Portions (2 People) &bull; Natural Tones Organic Theme</span>
        </footer>

      </div>
    </div>
  );
}

function RotateLoader() {
  return (
    <svg className="animate-spin h-4.5 w-4.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}
