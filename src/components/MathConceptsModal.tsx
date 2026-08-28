import React, { useState, useMemo } from "react";
import { X, Search, BookOpen, Sparkles, HelpCircle, ArrowRight } from "lucide-react";
import { MATH_CONCEPTS, MathConcept } from "../data/mathConcepts";
import { playSound } from "../utils/audio";

interface MathConceptsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MathConceptsModal: React.FC<MathConceptsModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activeConcept, setActiveConcept] = useState<MathConcept | null>(null);

  const categories = ["All", "Algebra", "Fractions", "Geometry", "Exponents", "Coordinates", "Logic"];

  const filteredConcepts = useMemo(() => {
    return MATH_CONCEPTS.filter((concept) => {
      const matchesCategory = selectedCategory === "All" || concept.category === selectedCategory;
      const matchesSearch =
        concept.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
        concept.definition.toLowerCase().includes(searchQuery.toLowerCase()) ||
        concept.example.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-black/60 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-400/20 border border-cyan-400/40 rounded-xl flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.3)]">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">SYNTHESIS LEXICON</span>
              </div>
              <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white">
                Math Concepts & Mental Models
              </h3>
            </div>
          </div>

          <button
            onClick={() => {
              playSound("pop");
              onClose();
            }}
            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="p-6 bg-black/40 border-b border-white/10 flex flex-col gap-4 shrink-0">
          {/* Search Bar */}
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts, terms, or definitions (e.g. 'equality', 'fraction', 'area')..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-10 py-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/60 font-sans transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar font-mono">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  playSound("pop");
                  setSelectedCategory(cat);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-cyan-400 text-black shadow-[0_0_12px_rgba(34,211,238,0.4)]"
                    : "bg-white/5 text-gray-400 hover:text-white border border-white/5"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
          {filteredConcepts.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <Search className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-sm font-mono text-gray-400">No math concepts found matching "{searchQuery}"</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
                className="mt-3 px-4 py-2 bg-white/5 border border-white/10 text-cyan-400 rounded-xl text-xs font-mono uppercase tracking-wider hover:bg-white/10"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredConcepts.map((concept) => (
                <div
                  key={concept.id}
                  onClick={() => setActiveConcept(concept)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    activeConcept?.id === concept.id
                      ? "bg-cyan-400/10 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                      : "bg-black/60 border-white/10 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded border border-cyan-400/30">
                        {concept.category}
                      </span>
                      <Sparkles className="w-3.5 h-3.5 text-gray-500" />
                    </div>

                    <h4 className="text-base font-bold text-white uppercase tracking-tight mb-2">
                      {concept.term}
                    </h4>

                    <p className="text-xs text-gray-300 leading-relaxed mb-4">
                      {concept.definition}
                    </p>
                  </div>

                  {/* Visual Representation Box */}
                  <div className="bg-[#050505] p-3 rounded-xl border border-white/10 font-mono text-[11px] text-cyan-300 whitespace-pre-wrap leading-tight mb-3">
                    {concept.visualRepresentation}
                  </div>

                  {/* Example & Socratic Question Callout */}
                  <div className="space-y-2 text-[11px]">
                    <div className="text-gray-400">
                      <span className="font-mono text-cyan-400 font-bold uppercase">Example: </span>
                      <span className="text-gray-300">{concept.example}</span>
                    </div>

                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 flex items-start gap-2">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="leading-snug">
                        <span className="font-mono text-[10px] uppercase font-bold text-amber-400 block mb-0.5">Koda's Socratic Inquiry</span>
                        {concept.socraticQuestion}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-black border-t border-white/10 flex items-center justify-between shrink-0 font-mono text-xs">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest">
            Showing {filteredConcepts.length} of {MATH_CONCEPTS.length} Curriculum Terms
          </span>

          <button
            onClick={() => {
              playSound("pop");
              onClose();
            }}
            className="px-5 py-2.5 bg-cyan-400 text-black font-bold uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:bg-cyan-300 transition-all"
          >
            Close Lexicon
          </button>
        </div>
      </div>
    </div>
  );
};
