import React, { useEffect, useState } from "react";
import { Plus, Trash2, Code, Sparkles, Sliders, Check, FolderHeart, Tag, Maximize2, Info, Copy, RotateCcw } from "lucide-react";
import { CustomSvgAsset, CountingQuestion } from "../types";
import { CountingAsset } from "./Assets";
import { sounds } from "../sound";
import { Button, Card, Tabs, TabsContent, TabsList, TabsTrigger } from "./ui";
import { useSvgLibrary } from "../assets/SvgLibraryContext";
import { SvgLibraryAsset } from "../assets/SvgLibraryAsset";
import { isSafeSvgMarkup } from "../assets/svgSafety";
import { preprocessSvgMarkup } from "../assets/svgPreprocess";
import { createSvgAssetId } from "../assets/svgIds";
import { svgAssetsApi, type SvgAssetUse } from "../api/svgAssets";

const STARTER_TEMPLATES = [
  {
    id: "tpl_apple",
    label: "Apple",
    scale: 1.0,
    markup: `<svg viewBox="0 0 24 24" fill="none">
  <path d="M12 5C12 5 13 2 15 2C17 2 18 3 18 5C18 7 16 8 14 8C12 8 12 5 12 5Z" fill="#4ADE80" />
  <path d="M12 21C9.5 21 7 19.5 6 17C5 14.5 5 11.5 6.5 9.5C8 7.5 10.5 7 12 7C13.5 7 16 7.5 17.5 9.5C19 11.5 19 14.5 18 17C17 19.5 14.5 21 12 21Z" fill="#EF4444" />
  <path d="M12 21C11.5 21 11 20.9 10.5 20.7C10.5 20.7 11.2 19.5 12 19.5C12.8 19.5 13.5 20.7 13.5 20.7C13 20.9 12.5 21 12 21Z" fill="#B91C1C" />
</svg>`
  },
  {
    id: "tpl_star",
    label: "Star",
    scale: 1.0,
    markup: `<svg viewBox="0 0 24 24" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1">
  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
</svg>`
  },
  {
    id: "tpl_heart",
    label: "Heart",
    scale: 1.0,
    markup: `<svg viewBox="0 0 24 24" fill="#EF4444" stroke="#DC2626" strokeWidth="1">
  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
</svg>`
  },
  {
    id: "tpl_sun",
    label: "Sun",
    scale: 1.0,
    markup: `<svg viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="5" fill="#F59E0B" />
  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
</svg>`
  },
  {
    id: "tpl_rocket",
    label: "Rocket",
    scale: 1.0,
    markup: `<svg viewBox="0 0 24 24" fill="none">
  <path d="M12 2C12 2 9 6 9 12C9 15 10 17 12 19C14 17 15 15 15 12C15 6 12 2 12 2Z" fill="#94A3B8" />
  <path d="M12 2C12 2 10.5 6 11 12C11.5 15 12 17 12 19C12 17 12.5 15 13 12C13.5 6 12 2 12 2Z" fill="#CBD5E1" />
  <path d="M9 14L5 18V20L9 17V14Z" fill="#475569" />
  <path d="M15 14L19 18V20L15 17V14Z" fill="#475569" />
  <circle cx="12" cy="10" r="2" fill="#38BDF8" />
  <circle cx="12" cy="10" r="1.2" fill="#E0F2FE" />
  <path d="M12 19L10 22H14L12 19Z" fill="#EF4444" />
</svg>`
  },
  {
    id: "tpl_dino",
    label: "Dinosaur",
    scale: 1.0,
    markup: `<svg viewBox="0 0 24 24" fill="none">
  <path d="M18 10h-2V7a1 1 0 0 0-1-1h-3V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2v3H5a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1z" fill="#10B981" />
</svg>`
  },
  {
    id: "tpl_car",
    label: "Toy Car",
    scale: 1.0,
    markup: `<svg viewBox="0 0 24 24" fill="none">
  <rect x="3" y="11" width="18" height="6" rx="2" fill="#3B82F6" />
  <path d="M6 11l2-5h8l2 5" stroke="#3B82F6" strokeWidth="2" fill="none" />
  <circle cx="7" cy="18" r="2" fill="#1F2937" />
  <circle cx="17" cy="18" r="2" fill="#1F2937" />
</svg>`
  },
  {
    id: "tpl_bear",
    label: "Bear",
    scale: 1.0,
    markup: `<svg viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="8" fill="#B45309" />
  <circle cx="8" cy="8" r="2.5" fill="#B45309" />
  <circle cx="16" cy="8" r="2.5" fill="#B45309" />
</svg>`
  },
  {
    id: "tpl_fish",
    label: "Fish",
    scale: 1.0,
    markup: `<svg viewBox="0 0 24 24" fill="none">
  <path d="M2 12C2 12 6 7 14 7C18 7 22 12 22 12C22 12 18 17 14 17C6 17 2 12 2 12Z" fill="#3B82F6" />
  <path d="M22 12L18 9V15L22 12Z" fill="#2563EB" />
</svg>`
  },
  {
    id: "tpl_butterfly",
    label: "Butterfly",
    scale: 1.0,
    markup: `<svg viewBox="0 0 24 24" fill="none">
  <path d="M12 4C10 2 6 2 4 5C2 8 4 12 12 14C20 12 22 8 20 5C18 2 14 2 12 4ZM12 4V20" stroke="#EC4899" strokeWidth="2" />
</svg>`
  },
  {
    id: "tpl_flower",
    label: "Flower",
    scale: 1.0,
    markup: `<svg viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="3" fill="#FBBF24" />
  <circle cx="12" cy="6" r="3" fill="#EF4444" />
  <circle cx="12" cy="18" r="3" fill="#EF4444" />
  <circle cx="6" cy="12" r="3" fill="#EF4444" />
  <circle cx="18" cy="12" r="3" fill="#EF4444" />
</svg>`
  },
  {
    id: "tpl_fox",
    label: "Fox Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M13 14 24 27 11 30Z" fill="#ffffff" />
  <path d="M51 14 40 27l13 3Z" fill="#ffffff" />
  <path d="M13 14 22 25l-9 3Z" fill="rgba(42,35,80,0.17)" />
  <path d="M51 14 42 25l9 3Z" fill="rgba(42,35,80,0.17)" />
  <path d="M32 20c11 0 17 7 17 15 0 7-4 12-9 15l-8 5-8-5c-5-3-9-8-9-15 0-8 6-15 17-15Z" fill="#ffffff" />
  <path d="M32 39c4 0 7 2 7 5 0 4-4 7-7 9-3-2-7-5-7-9 0-3 3-5 7-5Z" fill="rgba(42,35,80,0.17)" />
  <g fill="#2A2350"><circle cx="24" cy="33" r="3" /><circle cx="40" cy="33" r="3" /></g>
  <circle cx="32" cy="45" r="2.8" fill="#2A2350" />
</svg>`
  },
  {
    id: "tpl_panda_avatar",
    label: "Panda Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="17" cy="20" r="7.5" fill="#2A2350" />
  <circle cx="47" cy="20" r="7.5" fill="#2A2350" />
  <circle cx="32" cy="34" r="19" fill="#ffffff" />
  <ellipse cx="24" cy="31" rx="5.4" ry="6.4" fill="#2A2350" />
  <ellipse cx="40" cy="31" rx="5.4" ry="6.4" fill="#2A2350" />
  <circle cx="24" cy="31" r="2.1" fill="#ffffff" />
  <circle cx="40" cy="31" r="2.1" fill="#ffffff" />
  <ellipse cx="32" cy="42" rx="4" ry="2.9" fill="#2A2350" />
  <path d="M27 47c3 2 7 2 10 0" stroke="#2A2350" strokeWidth="2" strokeLinecap="round" fill="none" />
</svg>`
  },
  {
    id: "tpl_tiger_avatar",
    label: "Tiger Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="18" cy="21" r="6.5" fill="#ffffff" />
  <circle cx="46" cy="21" r="6.5" fill="#ffffff" />
  <circle cx="18" cy="21" r="3" fill="rgba(42,35,80,0.17)" />
  <circle cx="46" cy="21" r="3" fill="rgba(42,35,80,0.17)" />
  <circle cx="32" cy="35" r="19" fill="#ffffff" />
  <path d="M32 17v6M24 19l1.5 5M40 19l-1.5 5" stroke="#2A2350" strokeWidth="2.6" strokeLinecap="round" fill="none" />
  <g fill="#2A2350"><circle cx="24" cy="33" r="3" /><circle cx="40" cy="33" r="3" /></g>
  <ellipse cx="32" cy="43" rx="7" ry="5" fill="rgba(42,35,80,0.17)" />
  <path d="M32 41v3M28 47c2 1.5 6 1.5 8 0" stroke="#2A2350" strokeWidth="2" strokeLinecap="round" fill="none" />
</svg>`
  },
  {
    id: "tpl_unicorn_avatar",
    label: "Unicorn Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 7 37 21H27Z" fill="#ffffff" />
  <path d="M32 7 37 21H27Z" fill="rgba(42,35,80,0.17)" />
  <path d="M30 10h4M28.5 15h7" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
  <path d="M32 20c11 0 17 8 17 17s-7 16-17 16-17-5-17-16 6-17 17-17Z" fill="#ffffff" />
  <path d="M17 25c5-5 12-4 15 1-5 4-11 4-15-1ZM15 34c4-3 9-2 11 2-4 3-9 2-11-2Z" fill="rgba(42,35,80,0.17)" />
  <g fill="#2A2350"><circle cx="24" cy="34" r="3" /><circle cx="40" cy="34" r="3" /></g>
  <ellipse cx="32" cy="45" rx="5.5" ry="4" fill="rgba(42,35,80,0.17)" />
  <circle cx="30" cy="45" r="1.4" fill="#2A2350" />
  <circle cx="34" cy="45" r="1.4" fill="#2A2350" />
</svg>`
  },
  {
    id: "tpl_frog_avatar",
    label: "Frog Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="19" cy="21" r="8.5" fill="#ffffff" />
  <circle cx="45" cy="21" r="8.5" fill="#ffffff" />
  <circle cx="19" cy="21" r="3.6" fill="#2A2350" />
  <circle cx="45" cy="21" r="3.6" fill="#2A2350" />
  <path d="M32 26c12 0 19 6 19 14 0 7-8 12-19 12s-19-5-19-12c0-8 7-14 19-14Z" fill="#ffffff" />
  <path d="M23 41c5 5 13 5 18 0" stroke="#2A2350" strokeWidth="2.6" strokeLinecap="round" fill="none" />
  <circle cx="24" cy="47" r="1.6" fill="rgba(42,35,80,0.3)" />
  <circle cx="40" cy="47" r="1.6" fill="rgba(42,35,80,0.3)" />
</svg>`
  },
  {
    id: "tpl_monkey_avatar",
    label: "Monkey Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="13" cy="32" r="7.5" fill="#ffffff" />
  <circle cx="51" cy="32" r="7.5" fill="#ffffff" />
  <circle cx="13" cy="32" r="3.4" fill="rgba(42,35,80,0.17)" />
  <circle cx="51" cy="32" r="3.4" fill="rgba(42,35,80,0.17)" />
  <circle cx="32" cy="33" r="19" fill="#ffffff" />
  <path d="M32 26c8 0 12 5 12 10s-5 9-12 9-12-4-12-9 4-10 12-10Z" fill="rgba(42,35,80,0.17)" />
  <g fill="#2A2350"><circle cx="25" cy="29" r="3" /><circle cx="39" cy="29" r="3" /></g>
  <ellipse cx="32" cy="38" rx="3.6" ry="2.4" fill="#2A2350" />
  <path d="M27 43c3 2 7 2 10 0" stroke="#2A2350" strokeWidth="2" strokeLinecap="round" fill="none" />
</svg>`
  },
  {
    id: "tpl_octopus_avatar",
    label: "Octopus Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 13c11 0 18 8 18 18v7H14v-7c0-10 7-18 18-18Z" fill="#ffffff" />
  <path d="M14 38h36c0 5-2 9-5 11 0-4-2-6-4-6s-4 2-4 6c0-4-2-6-4-6s-4 2-4 6c0-4-2-6-4-6s-4 2-4 6c-3-2-5-6-5-11Z" fill="#ffffff" />
  <path d="M21 40c0 4-1 7-2 9M43 40c0 4 1 7 2 9" stroke="rgba(42,35,80,0.17)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
  <g fill="#2A2350"><circle cx="24.5" cy="29" r="3" /><circle cx="39.5" cy="29" r="3" /></g>
  <path d="M27 38c3 2 7 2 10 0" stroke="#2A2350" strokeWidth="2" strokeLinecap="round" fill="none" />
  <circle cx="22" cy="24" r="2.4" fill="rgba(42,35,80,0.17)" />
</svg>`
  },
  {
    id: "tpl_lion_avatar",
    label: "Lion Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="33" r="22" fill="rgba(42,35,80,0.17)" />
  <path d="M32 11v6M50 21l-4 4M54 33h-6M50 45l-4-4M32 55v-6M14 45l4-4M10 33h6M14 21l4 4" stroke="rgba(42,35,80,0.3)" strokeWidth="3" strokeLinecap="round" />
  <circle cx="32" cy="34" r="15" fill="#ffffff" />
  <g fill="#2A2350"><circle cx="25.5" cy="31" r="3" /><circle cx="38.5" cy="31" r="3" /></g>
  <ellipse cx="32" cy="39" rx="4.4" ry="3" fill="#2A2350" />
  <path d="M27 44c3 2 7 2 10 0" stroke="#2A2350" strokeWidth="2" strokeLinecap="round" fill="none" />
</svg>`
  },
  {
    id: "tpl_penguin_avatar",
    label: "Penguin Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="32" cy="33" rx="17" ry="21" fill="#ffffff" />
  <path d="M32 16c7 0 11 6 11 13 0 9-5 16-11 16s-11-7-11-16c0-7 4-13 11-13Z" fill="rgba(42,35,80,0.17)" />
  <g fill="#2A2350"><circle cx="26" cy="26" r="2.7" /><circle cx="38" cy="26" r="2.7" /></g>
  <path d="M32 31 38 35l-6 4-6-4Z" fill="#2A2350" />
  <path d="M13 30c-3 3-3 9 0 12M51 30c3 3 3 9 0 12" stroke="rgba(42,35,80,0.17)" strokeWidth="3" strokeLinecap="round" fill="none" />
</svg>`
  },
  {
    id: "tpl_koala_avatar",
    label: "Koala Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="14" cy="24" r="9" fill="#ffffff" />
  <circle cx="50" cy="24" r="9" fill="#ffffff" />
  <circle cx="14" cy="24" r="4.4" fill="rgba(42,35,80,0.17)" />
  <circle cx="50" cy="24" r="4.4" fill="rgba(42,35,80,0.17)" />
  <circle cx="32" cy="35" r="18" fill="#ffffff" />
  <g fill="#2A2350"><circle cx="24.5" cy="33" r="3" /><circle cx="39.5" cy="33" r="3" /></g>
  <path d="M32 38c3 0 5 2 5 5s-2 6-5 6-5-3-5-6 2-5 5-5Z" fill="#2A2350" />
</svg>`
  },
  {
    id: "tpl_rabbit_avatar",
    label: "Rabbit Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="24" cy="15" rx="5" ry="12" fill="#ffffff" />
  <ellipse cx="40" cy="15" rx="5" ry="12" fill="#ffffff" />
  <ellipse cx="24" cy="16" rx="2.2" ry="7.5" fill="rgba(42,35,80,0.17)" />
  <ellipse cx="40" cy="16" rx="2.2" ry="7.5" fill="rgba(42,35,80,0.17)" />
  <circle cx="32" cy="39" r="16" fill="#ffffff" />
  <g fill="#2A2350"><circle cx="25" cy="36" r="3" /><circle cx="39" cy="36" r="3" /></g>
  <path d="M32 41 34.6 43 32 45l-2.6-2Z" fill="#2A2350" />
  <path d="M26 47c4 2 8 2 12 0" stroke="#2A2350" strokeWidth="2" strokeLinecap="round" fill="none" />
</svg>`
  },
  {
    id: "tpl_cow_avatar",
    label: "Cow Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M11 19c-4 1-4 6 0 8 3 1 5-2 4-5Z" fill="rgba(42,35,80,0.3)" />
  <path d="M53 19c4 1 4 6 0 8-3 1-5-2-4-5Z" fill="rgba(42,35,80,0.3)" />
  <circle cx="32" cy="34" r="19" fill="#ffffff" />
  <path d="M20 22c4-3 8-2 9 2-4 2-8 1-9-2Z" fill="rgba(42,35,80,0.17)" />
  <g fill="#2A2350"><circle cx="24" cy="30" r="3" /><circle cx="40" cy="30" r="3" /></g>
  <ellipse cx="32" cy="43" rx="10" ry="7" fill="rgba(42,35,80,0.17)" />
  <ellipse cx="28" cy="43" rx="1.8" ry="2.4" fill="#2A2350" />
  <ellipse cx="36" cy="43" rx="1.8" ry="2.4" fill="#2A2350" />
</svg>`
  },
  {
    id: "tpl_pig_avatar",
    label: "Pig Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 19 25 26l-9 4Z" fill="#ffffff" />
  <path d="M48 19 39 26l9 4Z" fill="#ffffff" />
  <circle cx="32" cy="35" r="18" fill="#ffffff" />
  <g fill="#2A2350"><circle cx="24" cy="31" r="3" /><circle cx="40" cy="31" r="3" /></g>
  <ellipse cx="32" cy="43" rx="9.5" ry="7" fill="rgba(42,35,80,0.17)" />
  <ellipse cx="28.4" cy="43" rx="1.8" ry="2.4" fill="#2A2350" />
  <ellipse cx="35.6" cy="43" rx="1.8" ry="2.4" fill="#2A2350" />
</svg>`
  },
  {
    id: "tpl_whale_avatar",
    label: "Whale Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M30 10c0 4-1 7-3 9M36 12c0 3 1 6 2 8" stroke="rgba(42,35,80,0.3)" strokeWidth="3" strokeLinecap="round" fill="none" />
  <path d="M25 24c13 0 23 6 23 15 0 8-8 13-19 13-10 0-16-6-16-13 0-9 5-15 12-15Z" fill="#ffffff" />
  <path d="M48 32c4-3 9-4 9 0 0 4-2 9-5 11-2 1-4-3-4-6Z" fill="rgba(42,35,80,0.17)" />
  <path d="M13 41c9 4 21 4 30-1" stroke="rgba(42,35,80,0.17)" strokeWidth="2.4" fill="none" />
  <circle cx="23" cy="35" r="3" fill="#2A2350" />
  <path d="M17 45c4 3 9 3 13 0" stroke="#2A2350" strokeWidth="2.2" strokeLinecap="round" fill="none" />
</svg>`
  },
  {
    id: "tpl_owl_avatar",
    label: "Owl Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 17 25 26l-10 3Z" fill="#ffffff" />
  <path d="M49 17 39 26l10 3Z" fill="#ffffff" />
  <path d="M32 18c11 0 18 8 18 18s-8 17-18 17-18-6-18-17 7-18 18-18Z" fill="#ffffff" />
  <circle cx="24" cy="32" r="7.5" fill="rgba(42,35,80,0.17)" />
  <circle cx="40" cy="32" r="7.5" fill="rgba(42,35,80,0.17)" />
  <circle cx="24" cy="32" r="3.4" fill="#2A2350" />
  <circle cx="40" cy="32" r="3.4" fill="#2A2350" />
  <path d="M32 37 35.5 41 32 44.5 28.5 41Z" fill="#2A2350" />
  <path d="M25 47c4 2 10 2 14 0" stroke="rgba(42,35,80,0.3)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
</svg>`
  },
  {
    id: "tpl_bee_avatar",
    label: "Bee Avatar",
    scale: 1.0,
    markup: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M26 15c-2-4-5-6-8-5M38 15c2-4 5-6 8-5" stroke="#2A2350" strokeWidth="2" strokeLinecap="round" fill="none" />
  <circle cx="17" cy="9" r="2.2" fill="#2A2350" />
  <circle cx="47" cy="9" r="2.2" fill="#2A2350" />
  <ellipse cx="15" cy="34" rx="9" ry="6.5" transform="rotate(-32 15 34)" fill="rgba(42,35,80,0.17)" />
  <ellipse cx="49" cy="34" rx="9" ry="6.5" transform="rotate(32 49 34)" fill="rgba(42,35,80,0.17)" />
  <ellipse cx="32" cy="43" rx="13.5" ry="12.5" fill="#ffffff" />
  <path d="M21 39h22M23.5 47h17" stroke="#2A2350" strokeWidth="4" strokeLinecap="round" />
  <circle cx="32" cy="24" r="11" fill="#ffffff" />
  <circle cx="28" cy="23" r="2.5" fill="#2A2350" />
  <circle cx="36" cy="23" r="2.5" fill="#2A2350" />
  <path d="M29 28.5c1.8 1.6 4.2 1.6 6 0" stroke="#2A2350" strokeWidth="2" strokeLinecap="round" fill="none" />
</svg>`
  }
];

// Extracted so surfaces that only normalize markup (e.g. the curriculum studio's
// thumbnail field) need not import this whole designer.
export { preprocessSvgMarkup } from "../assets/svgPreprocess";

interface SvgDesignerProps {
  flush?: boolean;
}

export const SvgDesigner: React.FC<SvgDesignerProps> = ({
  flush = false,
}) => {
  const {
    assets: customSvgs,
    setAssets: setCustomSvgs,
    overrides: svgOverrides,
    setOverrides: setSvgOverrides,
    persistenceStatus,
  } = useSvgLibrary();
  const [labelInput, setLabelInput] = useState("");
  const [markupInput, setMarkupInput] = useState("");
  const [scaleInput, setScaleInput] = useState(1.0);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  // `null` means "not loaded" — distinct from a loaded-but-empty map. Conflating them made
  // a failed request claim every asset was unused, which is a false statement, not a blank.
  const [assetUsage, setAssetUsage] = useState<Record<string, SvgAssetUse[]> | null>(null);

  // Refetched whenever the library changes, so a newly linked asset stops reading "Not used
  // yet" without a reload. Failure is silent: usage is context, not something to block on.
  useEffect(() => {
    let cancelled = false;
    void svgAssetsApi.usage()
      .then(response => { if (!cancelled) setAssetUsage(response.usage); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [customSvgs.length]);
  const [libraryTab, setLibraryTab] = useState<"assets" | "built-in">("assets");
  const [notification, setNotification] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSave = () => {
    if (!labelInput.trim()) {
      triggerNotification("⚠️ Please provide an asset label.");
      return;
    }
    if (!markupInput.trim() || !markupInput.trim().toLowerCase().startsWith("<svg")) {
      triggerNotification("⚠️ Please paste valid SVG markup starting with <svg>.");
      return;
    }
    if (!isSafeSvgMarkup(markupInput)) {
      triggerNotification("⚠️ Remove scripts, event handlers, or embedded content from the SVG.");
      return;
    }

    sounds.playSuccess();
    const processedMarkup = preprocessSvgMarkup(markupInput);

    if (selectedAssetId && selectedAssetId.startsWith("override_")) {
      // Overriding a built-in SVG
      const type = selectedAssetId.replace("override_", "");
      const updated = {
        ...svgOverrides,
        [type]: { markup: processedMarkup, scale: scaleInput }
      };
      setSvgOverrides(updated);
      triggerNotification(`✅ Overrode built-in ${labelInput}!`);
    } else if (selectedAssetId) {
      // Editing existing custom asset
      const updated = customSvgs.map(a =>
        a.id === selectedAssetId 
          ? { ...a, label: labelInput.trim(), markup: processedMarkup, scale: scaleInput } 
          : a
      );
      setCustomSvgs(updated);
      // Nothing to propagate: questions reference this asset by id, so they follow the edit.
      triggerNotification("✨ Asset updated successfully!");
    } else {
      // Creating new custom asset
      const newAsset: CustomSvgAsset = {
        id: createSvgAssetId(),
        label: labelInput.trim(),
        markup: processedMarkup,
        scale: scaleInput
      };
      const updated = [...customSvgs, newAsset];
      setCustomSvgs(updated);
      setSelectedAssetId(newAsset.id);
      triggerNotification("🎉 Asset added to library!");
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playPop();
    const updated = customSvgs.filter(a => a.id !== id);
    setCustomSvgs(updated);
    if (selectedAssetId === id) {
      handleClear();
    }
    triggerNotification("🗑️ Asset removed from library.");
  };

  const handleResetOverride = () => {
    if (!selectedAssetId || !selectedAssetId.startsWith("override_")) return;
    sounds.playPop();
    const type = selectedAssetId.replace("override_", "");
    
    const updated = { ...svgOverrides };
    delete updated[type];
    setSvgOverrides(updated);

    const defaultTpl = STARTER_TEMPLATES.find(t => t.id === `tpl_${type}`);
    if (defaultTpl) {
      setLabelInput(defaultTpl.label);
      setMarkupInput(defaultTpl.markup);
      setScaleInput(defaultTpl.scale);
    }
    triggerNotification(`🔄 Restored built-in ${labelInput} to default!`);
  };

  const handleClear = () => {
    sounds.playPop();
    setLabelInput("");
    setMarkupInput("");
    setScaleInput(1.0);
    setSelectedAssetId(null);
  };

  const handleResetForm = () => {
    setIsResetting(true);
    handleClear();
    window.setTimeout(() => setIsResetting(false), 350);
  };

  const selectAsset = (asset: { id?: string; label: string; markup: string; scale: number }) => {
    sounds.playPop();
    setSelectedAssetId(asset.id || null);
    setLabelInput(asset.label);
    setMarkupInput(asset.markup);
    setScaleInput(asset.scale || 1.0);
  };

  const selectBuiltInAsset = (type: string, defaultLabel: string, defaultMarkup: string) => {
    sounds.playPop();
    const override = svgOverrides[type];
    setSelectedAssetId(`override_${type}`);
    setLabelInput(defaultLabel);
    if (override) {
      setMarkupInput(override.markup);
      setScaleInput(override.scale || 1.0);
    } else {
      setMarkupInput(defaultMarkup);
      setScaleInput(1.0);
    }
  };

  return (
    <div className={`flex-1 flex flex-col xl:grid xl:grid-cols-[17rem_minmax(0,1fr)_19rem] h-full overflow-y-auto xl:overflow-hidden bg-indigo-50/30 text-slate-800 ${flush ? "p-0 gap-3" : "p-3 gap-4 md:p-4"}`}>
      
      {/* LEFT PANEL: Asset Library List & Templates */}
      <Card className={`w-full xl:w-auto xl:min-h-0 flex flex-col p-3 overflow-hidden gap-3 shrink-0 ${flush ? "rounded-none" : ""}`}>
        <div className="flex shrink-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">1</span>
              SVG library
            </h3>
            <p className="mt-1 pl-7 text-[10px] text-slate-500">Choose an asset or start a new one</p>
          </div>
          <Button
            onClick={() => {
              setLibraryTab("assets");
              handleClear();
            }}
            variant="secondary"
            size="xs"
            className="shrink-0 whitespace-nowrap text-indigo-600"
          >
            <Plus size={10} /> New
          </Button>
        </div>

        <Tabs
          value={libraryTab}
          onValueChange={value => setLibraryTab(value as "assets" | "built-in")}
          variant="underline"
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="shrink-0 gap-3 px-0" aria-label="SVG library sections">
            <TabsTrigger value="assets" className="flex-1 justify-start py-2 text-[11px]">
              <FolderHeart size={13} /> Asset library
            </TabsTrigger>
            <TabsTrigger value="built-in" className="flex-1 justify-start py-2 text-[11px]">
              <Sparkles size={13} /> Built-in SVGs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="min-h-0 flex-1 overflow-y-auto pt-2 pr-1">
            <div className="space-y-1.5">
            {customSvgs.length === 0 ? (
              <div className="h-28 flex flex-col items-center justify-center text-center p-3 border border-dashed border-slate-200 rounded-xl text-slate-400">
                <FolderHeart size={20} className="mb-1 text-slate-300" />
                <p className="text-[10px] font-bold">No custom SVGs</p>
                <p className="text-[8px] text-slate-500 mt-0.5">Build one on the right to start!</p>
              </div>
            ) : (
              customSvgs.map((asset) => {
                const isSelected = selectedAssetId === asset.id;
                return (
                  <Card
                    interactive
                    key={asset.id}
                    onClick={() => selectAsset(asset)}
                    className={`group p-2 rounded-xl flex items-center justify-between ${
                      isSelected
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10"
                        : "bg-slate-50/50 border-slate-200/70 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <SvgLibraryAsset assetId={asset.id} size={22} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate leading-tight">{asset.label}</p>
                        <p className={`text-[9px] font-mono mt-0.5 ${isSelected ? "text-indigo-200" : "text-slate-400"}`}>
                          Scale: {Math.round(asset.scale * 100)}%
                        </p>
                        {/* The link lives on the skill, so without this the library cannot
                            show that an asset is in use — or that deleting it strands a
                            skill's artwork. */}
                        {assetUsage && (
                          <p
                            className={`text-[9px] mt-0.5 truncate ${
                              isSelected ? "text-indigo-100"
                                : (assetUsage[asset.id]?.length ?? 0) > 0 ? "text-emerald-600" : "text-slate-400"
                            }`}
                            title={(assetUsage[asset.id] ?? []).map(use => `${use.curriculumTitle} · ${use.skillLabel}`).join("\n")}
                          >
                            {(assetUsage[asset.id]?.length ?? 0) === 0
                              ? "Not used yet"
                              : assetUsage[asset.id].length === 1
                                ? `Used by ${assetUsage[asset.id][0].skillLabel}`
                                : `Used by ${assetUsage[asset.id].length} skills`}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={(e) => handleDelete(asset.id, e)}
                      variant="outline"
                      size="xs"
                      className={`h-7 w-7 px-0 opacity-0 group-hover:opacity-100 ${
                        isSelected
                          ? "bg-indigo-700/50 hover:bg-indigo-800/50 border-indigo-500 text-indigo-100 hover:text-white"
                          : "bg-white hover:bg-red-50 border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200"
                      }`}
                      title="Delete Asset"
                    >
                      <Trash2 size={10} />
                    </Button>
                  </Card>
                );
              })
            )}
            </div>
          </TabsContent>

          <TabsContent value="built-in" className="min-h-0 flex-1 overflow-y-auto pt-2 pr-1">
            <div className="space-y-1.5">
              {STARTER_TEMPLATES.map((tpl) => {
                const type = tpl.id.replace("tpl_", "");
                const isOverridden = !!svgOverrides[type];
                const isSelected = selectedAssetId === `override_${type}`;
                return (
                  <Card
                    interactive
                    key={tpl.id}
                    onClick={() => selectBuiltInAsset(type, tpl.label, tpl.markup)}
                    className={`p-2 rounded-xl flex items-center justify-between ${
                      isSelected
                        ? "bg-slate-100 border-indigo-300"
                        : "bg-slate-50/30 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <CountingAsset type={type as any} size={22} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-700 truncate">{tpl.label}</p>
                        <p className="text-[8px] text-slate-400">Click to customize</p>
                      </div>
                    </div>
                    {isOverridden && (
                      <span className="text-[8px] bg-green-50 text-green-600 font-bold border border-green-200 px-1 rounded uppercase tracking-wide">
                        Active
                      </span>
                    )}
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

      </Card>

      {/* CENTER & RIGHT PANEL: Workspace Editor & Card Preview */}
      <div className="contents">
        
        {/* Editor Settings Form */}
        <Card className={`min-w-0 p-4 flex flex-col gap-3 ${flush ? "rounded-none" : ""}`}>
          <div className="flex items-start gap-2.5 border-b border-slate-100 pb-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">2</span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800">
                {selectedAssetId && selectedAssetId.startsWith("override_") 
                  ? `Override Built-in ${labelInput}` 
                  : selectedAssetId 
                  ? "Edit Custom Asset" 
                  : "Build Custom Asset"}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Convert any SVG markup into a high-quality responsive object
              </p>
            </div>
            <span
              className={`ml-auto shrink-0 rounded-full border px-2 py-1 text-[9px] font-medium ${
                persistenceStatus === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : persistenceStatus === "saved"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-indigo-200 bg-indigo-50 text-indigo-700"
              }`}
              title={persistenceStatus === "error" ? "MongoDB unavailable; changes remain cached locally" : undefined}
            >
              {persistenceStatus === "loading" && "Loading…"}
              {persistenceStatus === "saving" && "Saving…"}
              {persistenceStatus === "saved" && "MongoDB"}
              {persistenceStatus === "error" && "Local cache"}
              {persistenceStatus === "local" && "Local"}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5">
                <Tag size={12} className="text-slate-400" /> Asset Name / Label
              </label>
              <input
                type="text"
                placeholder="e.g., Red Apple, Golden Star, Little Dinosaur"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                disabled={selectedAssetId?.startsWith("override_")}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-600 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Maximize2 size={12} className="text-slate-400" /> Sizing Scale Factor
                </span>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 font-mono font-bold px-1.5 py-0.5 rounded border border-indigo-100">
                  {Math.round(scaleInput * 100)}%
                </span>
              </label>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
                <Sliders className="text-slate-400" size={14} />
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  value={scaleInput}
                  onChange={(e) => setScaleInput(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
              <p className="text-[9px] text-slate-400 leading-normal">
                Adjusts the rendered item footprint relative to standard emojis. Use this to make larger SVGs smaller or vice versa.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                <Code size={12} /> SVG Source Code
              </label>
              <textarea
                rows={9}
                placeholder={`Paste standard raw SVG here, e.g.:
<svg viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="gold" />
</svg>`}
                value={markupInput}
                onChange={(e) => setMarkupInput(e.target.value)}
                className="w-full text-[10px] font-mono p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all leading-normal"
              />
            </div>
          </div>

          <div className="mt-auto pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0">
            <Button
              onClick={handleResetForm}
              variant="outline"
              size="icon"
              className="h-9 w-9"
              title="Reset form"
              aria-label="Reset form"
              loading={isResetting}
            >
              <RotateCcw size={14} />
            </Button>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {selectedAssetId && selectedAssetId.startsWith("override_") && (
                <Button
                  onClick={handleResetOverride}
                  variant="outline"
                  size="sm"
                  className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                  <RotateCcw size={12} /> Reset to Default
                </Button>
              )}
              {selectedAssetId && !selectedAssetId.startsWith("override_") && (
                <Button
                  onClick={() => {
                    const label = labelInput.trim();
                    if (!label) {
                      triggerNotification("Add an asset name before saving a copy.");
                      return;
                    }
                    if (!isSafeSvgMarkup(markupInput)) {
                      triggerNotification("This SVG contains unsupported or unsafe markup.");
                      return;
                    }
                    sounds.playSuccess();
                    const newAsset: CustomSvgAsset = {
                      id: createSvgAssetId(),
                      label: `${label} Copy`,
                      markup: preprocessSvgMarkup(markupInput),
                      scale: scaleInput
                    };
                    const updated = [...customSvgs, newAsset];
                    setCustomSvgs(updated);
                    setSelectedAssetId(newAsset.id);
                    setLabelInput(newAsset.label);
                    triggerNotification("🎉 Saved as a new copy!");
                  }}
                  variant="outline"
                  size="sm"
                >
                  <Copy size={12} /> Save as Copy
                </Button>
              )}
              <Button
                onClick={handleSave}
                size="sm"
                loading={persistenceStatus === "saving"}
                loadingText="Saving..."
              >
                <Check size={14} /> {selectedAssetId && selectedAssetId.startsWith("override_") ? "Override Default" : selectedAssetId ? "Save Changes" : "Save to Library"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Live Card Preview Simulator */}
        <Card className={`w-full xl:w-auto p-4 flex flex-col gap-3 select-none ${flush ? "rounded-none" : ""}`}>
          <div className="flex items-start gap-2.5 border-b border-slate-100 pb-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">3</span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800">Live Simulator Preview</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Real-time scaling & display simulation
              </p>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-50/50 border border-slate-200/70 rounded-xl relative overflow-hidden min-h-[220px]">
            {/* Display grid grid-lines backdrop to simulate workspace */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:20px_20px]" />

            {markupInput.trim().toLowerCase().startsWith("<svg") ? (
              <div className="flex flex-col items-center gap-4">
                {/* Simulated Drag Card wrapper */}
                <div className="w-20 h-20 flex items-center justify-center transition-all scale-110 relative group">
                  <CountingAsset 
                    type="custom_svg" 
                    customSvgMarkup={preprocessSvgMarkup(markupInput)} 
                    size={48} 
                    scale={scaleInput}
                  />
                </div>
                
                <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider uppercase bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">
                  Footprint: {Math.round(48 * scaleInput)}px
                </span>
              </div>
            ) : (
              <div className="text-center text-slate-400 p-4 flex flex-col items-center">
                <Sparkles size={28} className="mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-600">Awaiting SVG code</p>
                <p className="text-[9px] text-slate-400 mt-1">Paste SVG markup or click a template to see it here</p>
              </div>
            )}
          </div>

          {/* Sizing guides */}
          <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            <h4 className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
              <Info size={12} className="text-slate-400" /> Sizing Guide
            </h4>
            <ul className="text-[9px] text-slate-400 space-y-1 leading-normal list-disc list-inside">
              <li>SVGs adapt to both the sidebar grid and drag cards.</li>
              <li>Always check if it centers well inside the white box.</li>
              <li>If it overflows or sits off-center, verify the `viewBox` coordinates.</li>
            </ul>
          </div>
        </Card>

      </div>

      {/* Floating Action Notifications */}
      {notification && (
        <Card className="fixed bottom-6 right-6 px-4 py-2.5 border-indigo-100 text-slate-700 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold z-[9999] animate-slide-in">
          {notification}
        </Card>
      )}
    </div>
  );
};
