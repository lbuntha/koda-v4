import React from "react";

/**
 * Shared soft-3D artwork for Goods Sort.
 *
 * This zero-size sprite is mounted once per canvas. Symbols use a consistent upper-left
 * light, dark lower-right edge, and simple painted contact shadows instead of SVG filters.
 * The latter matters on iOS Safari, where dozens of animated filter surfaces are costly.
 */
export const GoodsAssetLibrary: React.FC = React.memo(() => (
  <svg
    aria-hidden="true"
    width="0"
    height="0"
    className="pointer-events-none absolute"
    style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
  >
    <defs>
      <linearGradient id="goods-red" x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF7B70" /><stop offset=".52" stopColor="#EF3B4F" /><stop offset="1" stopColor="#A91534" />
      </linearGradient>
      <linearGradient id="goods-blue" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#76D9FF" /><stop offset=".5" stopColor="#3298F0" /><stop offset="1" stopColor="#1857B7" />
      </linearGradient>
      <linearGradient id="goods-cyan" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8DF4F1" /><stop offset=".5" stopColor="#23C8D6" /><stop offset="1" stopColor="#087C9E" />
      </linearGradient>
      <linearGradient id="goods-pink" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFB3DB" /><stop offset=".5" stopColor="#F15AA7" /><stop offset="1" stopColor="#B72478" />
      </linearGradient>
      <linearGradient id="goods-purple" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#C7B5FF" /><stop offset=".5" stopColor="#8A6BEF" /><stop offset="1" stopColor="#5032AC" />
      </linearGradient>
      <linearGradient id="goods-green" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#88EBAC" /><stop offset=".5" stopColor="#30B979" /><stop offset="1" stopColor="#13724F" />
      </linearGradient>
      <linearGradient id="goods-yellow" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFF59B" /><stop offset=".52" stopColor="#FFD23F" /><stop offset="1" stopColor="#E39A18" />
      </linearGradient>
      <linearGradient id="goods-gold" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFF1A0" /><stop offset=".48" stopColor="#F5B82E" /><stop offset="1" stopColor="#B86A12" />
      </linearGradient>
      <linearGradient id="goods-orange" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFD08A" /><stop offset=".5" stopColor="#F58B32" /><stop offset="1" stopColor="#B84A20" />
      </linearGradient>
      <linearGradient id="goods-brown" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#E6AD70" /><stop offset=".52" stopColor="#AD6537" /><stop offset="1" stopColor="#6E3725" />
      </linearGradient>
      <linearGradient id="goods-white" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF" /><stop offset=".56" stopColor="#E9F2FA" /><stop offset="1" stopColor="#B7C7D8" />
      </linearGradient>
      <linearGradient id="goods-metal" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F8FAFC" /><stop offset=".28" stopColor="#BFC9D8" /><stop offset=".62" stopColor="#7C899D" /><stop offset="1" stopColor="#465267" />
      </linearGradient>
      <radialGradient id="goods-glass" cx=".32" cy=".24" r=".78">
        <stop stopColor="#DFFAFF" /><stop offset=".38" stopColor="#5CDAF4" /><stop offset=".76" stopColor="#5578E8" /><stop offset="1" stopColor="#5632A8" />
      </radialGradient>
      <radialGradient id="goods-cookie-dough" cx=".3" cy=".22" r=".82">
        <stop stopColor="#FFE8A8" /><stop offset=".42" stopColor="#F4BA62" /><stop offset=".78" stopColor="#D47A31" /><stop offset="1" stopColor="#9A4E25" />
      </radialGradient>
      <linearGradient id="goods-cookie-edge" x1="13" y1="10" x2="50" y2="57" gradientUnits="userSpaceOnUse">
        <stop stopColor="#EFA451" /><stop offset=".58" stopColor="#B85C2B" /><stop offset="1" stopColor="#71351F" />
      </linearGradient>
      <radialGradient id="goods-cookie-chip" cx=".3" cy=".2" r=".9">
        <stop stopColor="#8A4B2E" /><stop offset=".52" stopColor="#542A20" /><stop offset="1" stopColor="#291716" />
      </radialGradient>

      <symbol id="goods-chips" viewBox="0 0 64 64">
        <path d="M14 9Q32 5 50 9l4 44q-22 7-44 0Z" fill="url(#goods-red)" stroke="#95132D" strokeWidth="1.4" />
        <path d="M14 9q18 6 36 0l-1 7q-17 5-35 0ZM11 49q21 6 42 0l1 4q-22 7-44 0Z" fill="#FFB080" opacity=".65" />
        <ellipse cx="32" cy="34" rx="15" ry="12" fill="#FFF2C5" />
        <path d="M21 37q5-14 17-10 10 5 2 14-12 8-19-4Z" fill="url(#goods-gold)" stroke="#C67B18" />
        <path d="M17 14q5-3 8-1l-3 33" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" opacity=".45" />
      </symbol>
      <symbol id="goods-cola" viewBox="0 0 64 64">
        <rect x="17" y="9" width="30" height="47" rx="7" fill="url(#goods-red)" stroke="#7F1024" strokeWidth="1.4" />
        <ellipse cx="32" cy="10" rx="14" ry="4" fill="url(#goods-metal)" /><ellipse cx="32" cy="10" rx="5" ry="1.6" fill="#596579" />
        <path d="M18 30q14-10 28-2v12q-14-8-28 2Z" fill="#FFF9E7" /><path d="M23 36q7-10 17-4 5 6-3 9-9 4-14-5Z" fill="#F7C948" />
        <path d="M21 15v33" stroke="#FFF" strokeWidth="3" strokeLinecap="round" opacity=".35" />
      </symbol>
      <symbol id="goods-milk" viewBox="0 0 64 64">
        <path d="M17 20 25 8h17l6 12v36H16V20Z" fill="url(#goods-white)" stroke="#3987C4" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="m17 20 8-12h17l6 12Z" fill="url(#goods-blue)" /><path d="m25 8 9 7 8-7" fill="#C9ECFF" />
        <rect x="20" y="29" width="24" height="17" rx="5" fill="#FFF" opacity=".9" /><path d="M25 38q2-7 7-3 5-5 8 3-3 7-8 3-5 4-7-3Z" fill="#62BDF4" />
      </symbol>
      <symbol id="goods-donut" viewBox="0 0 64 64">
        <ellipse cx="32" cy="36" rx="24" ry="20" fill="url(#goods-cookie-dough)" stroke="#8E4A27" strokeWidth="1.4" />
        <path d="M10 32q3-17 21-18 20 0 24 17-4 9-8 4-3 9-9 3-6 7-11 0-7 6-9-3-5 5-8-3Z" fill="url(#goods-pink)" />
        <ellipse cx="32" cy="33" rx="7" ry="6" fill="#8E4A27" /><path d="m17 26 5-3m20-1 5 3M20 35l5 2m15-2 5-3m-16-12 2 4" stroke="#FFF1A4" strokeWidth="2" strokeLinecap="round" />
      </symbol>
      <symbol id="goods-teddy" viewBox="0 0 64 64">
        <circle cx="18" cy="17" r="9" fill="url(#goods-brown)" stroke="#71351F" /><circle cx="46" cy="17" r="9" fill="url(#goods-brown)" stroke="#71351F" />
        <ellipse cx="32" cy="43" rx="19" ry="15" fill="url(#goods-brown)" stroke="#71351F" /><circle cx="32" cy="25" r="18" fill="url(#goods-brown)" stroke="#71351F" />
        <ellipse cx="32" cy="31" rx="10" ry="8" fill="#E9B77A" /><circle cx="26" cy="23" r="2" fill="#302018" /><circle cx="38" cy="23" r="2" fill="#302018" />
        <path d="M29 29q3-4 6 0-1 5-3 4-2 1-3-4Zm3 4q-3 4-5 1m5-1q3 4 5 1" fill="#3A2017" stroke="#6C3522" strokeLinecap="round" />
      </symbol>
      <symbol id="goods-duck" viewBox="0 0 64 64">
        <ellipse cx="29" cy="43" rx="22" ry="14" fill="url(#goods-yellow)" stroke="#C98A15" /><circle cx="35" cy="25" r="16" fill="url(#goods-yellow)" stroke="#C98A15" />
        <path d="M46 28q12 0 14 6-6 7-16 1Z" fill="url(#goods-orange)" stroke="#D35D20" /><ellipse cx="25" cy="44" rx="11" ry="7" fill="#F1B91F" transform="rotate(-12 25 44)" />
        <circle cx="40" cy="22" r="2.2" fill="#253044" /><circle cx="39.4" cy="21.3" r=".7" fill="#FFF" />
      </symbol>
      <symbol id="goods-popsicle" viewBox="0 0 64 64">
        <rect x="28" y="44" width="8" height="14" rx="3" fill="url(#goods-brown)" /><path d="M16 20Q16 7 29 7h6q13 0 13 13v28H16Z" fill="url(#goods-purple)" stroke="#5534A8" strokeWidth="1.4" />
        <path d="M18 32 46 14v13L18 44Z" fill="url(#goods-pink)" opacity=".82" /><path d="M21 16q2-5 7-5" stroke="#FFF" strokeWidth="3" strokeLinecap="round" opacity=".5" />
      </symbol>
      <symbol id="goods-apple" viewBox="0 0 64 64">
        <path d="M33 17q3-9 10-10" fill="none" stroke="#6E4523" strokeWidth="4" strokeLinecap="round" /><path d="M35 13q7-8 14-2-5 8-14 5Z" fill="url(#goods-green)" />
        <path d="M32 20q13-9 22 4 8 13-5 28-9 9-17 3-8 6-17-3Q2 37 10 24q9-13 22-4Z" fill="url(#goods-red)" stroke="#A91732" strokeWidth="1.4" />
        <path d="M17 25q4-6 10-5" stroke="#FFF" strokeWidth="3" strokeLinecap="round" opacity=".5" />
      </symbol>
      <symbol id="goods-burger" viewBox="0 0 64 64">
        <path d="M9 27Q13 10 32 10t23 17Z" fill="url(#goods-gold)" stroke="#B76A20" /><path d="M11 31h42l-4 7H15Z" fill="#4F8F45" />
        <path d="m11 38 12-7 10 7 11-7 10 7-6 7H16Z" fill="#FFD84D" /><rect x="11" y="42" width="43" height="8" rx="4" fill="url(#goods-brown)" />
        <path d="M10 49h44q-2 8-10 8H20q-8 0-10-8Z" fill="url(#goods-gold)" stroke="#B76A20" /><g fill="#FFF2B0"><ellipse cx="23" cy="18" rx="2" ry="1"/><ellipse cx="35" cy="15" rx="2" ry="1"/><ellipse cx="44" cy="21" rx="2" ry="1"/></g>
      </symbol>
      <symbol id="goods-plant" viewBox="0 0 64 64">
        <path d="M32 39Q10 32 13 13q17 0 19 20Q33 10 51 8q4 20-19 31Z" fill="url(#goods-green)" stroke="#13724F" strokeWidth="1.3" /><path d="M32 38 21 20m11 18 10-19" stroke="#D1F6C9" strokeWidth="2" />
        <path d="M16 38h32l-4 19H20Z" fill="url(#goods-orange)" stroke="#9A4723" /><path d="M17 42h30" stroke="#FFD09C" strokeWidth="2" opacity=".65" />
      </symbol>
      <symbol id="goods-clock" viewBox="0 0 64 64">
        <path d="m17 16-6-6m36 6 6-6" stroke="#486076" strokeWidth="5" strokeLinecap="round" /><circle cx="32" cy="34" r="23" fill="url(#goods-cyan)" stroke="#176A83" strokeWidth="1.5" />
        <circle cx="32" cy="34" r="17" fill="url(#goods-white)" /><path d="M32 22v13l9 6" fill="none" stroke="#40536A" strokeWidth="3" strokeLinecap="round" /><circle cx="32" cy="35" r="2.5" fill="#40536A" />
        <path d="m18 53-4 5m32-5 4 5" stroke="#40536A" strokeWidth="4" strokeLinecap="round" />
      </symbol>
      <symbol id="goods-pencil" viewBox="0 0 64 64">
        <rect x="8" y="19" width="48" height="35" rx="8" fill="url(#goods-yellow)" stroke="#B77C12" strokeWidth="1.4" /><path d="M9 30h46" stroke="#FFF5B0" strokeWidth="2" />
        <path d="m19 40 22-22 7 7-22 22-10 3Z" fill="url(#goods-orange)" stroke="#A94B21" /><path d="m41 18 4-4 7 7-4 4Z" fill="url(#goods-pink)" /><path d="m16 50 3-10 7 7Z" fill="#4B3A32" />
      </symbol>
      <symbol id="goods-gem" viewBox="0 0 64 64">
        <path d="m12 23 9-13h22l9 13-20 34Z" fill="url(#goods-glass)" stroke="#4933A5" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m12 23 20 5 20-5M21 10l11 18 11-18M32 28v29" fill="none" stroke="#DDFBFF" strokeWidth="1.5" opacity=".72" /><path d="m22 15 5-3" stroke="#FFF" strokeWidth="3" strokeLinecap="round" />
      </symbol>
      <symbol id="goods-crown" viewBox="0 0 64 64">
        <path d="m9 18 13 12 10-20 10 20 13-12-6 32H15Z" fill="url(#goods-gold)" stroke="#A96510" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M15 43h34v10H15Z" fill="url(#goods-orange)" /><circle cx="22" cy="38" r="3" fill="#EF4F69" /><circle cx="32" cy="34" r="3" fill="#55C7EC" /><circle cx="42" cy="38" r="3" fill="#8A6BEF" />
      </symbol>
      <symbol id="goods-star" viewBox="0 0 64 64">
        <path d="m32 7 7 15 17 2-12 12 3 17-15-8-15 8 3-17L8 24l17-2Z" fill="url(#goods-gold)" stroke="#A96510" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M25 18q6-6 12 0" stroke="#FFF8C7" strokeWidth="3" strokeLinecap="round" opacity=".75" /><path d="M27 32q5 5 10 0" fill="none" stroke="#8B5918" strokeWidth="2" strokeLinecap="round" />
      </symbol>
      <symbol id="goods-gift" viewBox="0 0 64 64">
        <path d="M11 24h42v33H11Z" fill="url(#goods-pink)" stroke="#A91F69" strokeWidth="1.4" /><path d="M8 20h48v12H8Z" fill="url(#goods-red)" stroke="#A91F69" /><path d="M28 20h8v37h-8Z" fill="url(#goods-yellow)" />
        <path d="M32 20Q16 18 19 9q3-8 13 11Zm0 0Q48 18 45 9q-3-8-13 11Z" fill="url(#goods-gold)" stroke="#B46B11" />
      </symbol>
      <symbol id="goods-pizza" viewBox="0 0 64 64">
        <path d="M10 51 28 8q19 7 27 26Z" fill="url(#goods-gold)" stroke="#A95B25" strokeWidth="1.5" strokeLinejoin="round" /><path d="M28 8q19 5 27 26" fill="none" stroke="url(#goods-brown)" strokeWidth="8" />
        <path d="M16 44 49 31" stroke="#F1543F" strokeWidth="3" opacity=".8" /><g fill="#D93B34"><circle cx="28" cy="31" r="4"/><circle cx="40" cy="25" r="4"/><circle cx="37" cy="39" r="3.5"/></g>
      </symbol>
      <symbol id="goods-icecream" viewBox="0 0 64 64">
        <path d="m19 31 13 28 13-28Z" fill="url(#goods-gold)" stroke="#A86624" /><path d="m23 38 16 12m-12-15 11 9" stroke="#C57A29" opacity=".7" />
        <path d="M18 30q-3-10 7-13-1-10 8-11 9 1 8 11 10 3 6 13Z" fill="url(#goods-pink)" stroke="#AA276E" strokeWidth="1.4" /><path d="M23 20q3-8 9-8" stroke="#FFF" strokeWidth="3" strokeLinecap="round" opacity=".55" />
      </symbol>
      <symbol id="goods-cookie" viewBox="0 0 64 64">
        <path d="M32 7c15 0 26 11 26 25S47 58 32 58 6 47 6 32 17 7 32 7Z" fill="url(#goods-cookie-edge)" />
        <path d="M32 5c15 0 25 11 25 25S47 55 32 55 7 45 7 30 17 5 32 5Z" fill="url(#goods-cookie-dough)" stroke="#8A4422" strokeWidth="1.4" />
        <path d="M14 20c4-8 12-12 20-11-10 3-16 10-18 20-3-2-4-5-2-9Z" fill="#FFF4C7" opacity=".62" />
        <path d="M12 36c4 10 13 16 24 15 7-1 13-5 17-11-3 10-11 15-21 15-10 0-18-5-20-19Z" fill="#8D4525" opacity=".2" />
        <g fill="#D68B42" opacity=".42">
          <circle cx="26" cy="14" r="1.5" /><circle cx="47" cy="25" r="1.8" /><circle cx="15" cy="31" r="1.7" />
          <circle cx="39" cy="44" r="1.6" /><circle cx="22" cy="47" r="1.3" />
        </g>
        <g fill="url(#goods-cookie-chip)" stroke="#3B2019" strokeWidth=".6">
          <circle cx="20" cy="21" r="3.6" /><circle cx="39" cy="17" r="4" /><circle cx="47" cy="33" r="3.4" />
          <circle cx="31" cy="35" r="4.2" /><circle cx="18" cy="42" r="3.1" /><circle cx="40" cy="47" r="2.6" />
        </g>
        <g fill="#C98255" opacity=".55">
          <circle cx="18.8" cy="19.8" r="1" /><circle cx="37.7" cy="15.7" r="1.1" /><circle cx="29.5" cy="33.2" r="1.1" />
          <circle cx="45.8" cy="31.8" r=".9" />
        </g>
      </symbol>
      <symbol id="goods-candy" viewBox="0 0 64 64">
        <path d="m17 24-11-9 4 14-4 14 12-8m29-11 11-9-4 14 4 14-12-8" fill="url(#goods-purple)" stroke="#4D34A1" strokeLinejoin="round" />
        <rect x="15" y="18" width="34" height="28" rx="13" fill="url(#goods-pink)" stroke="#A91E6B" strokeWidth="1.4" /><path d="M23 23q5-4 10-2" stroke="#FFF" strokeWidth="3" strokeLinecap="round" opacity=".55" />
      </symbol>
      <symbol id="goods-car" viewBox="0 0 64 64">
        <path d="M8 37q1-9 10-11l7-11h20l8 13q5 2 5 9v10H8Z" fill="url(#goods-blue)" stroke="#174E9B" strokeWidth="1.4" /><path d="m25 18-5 10h29l-6-10Z" fill="#D9F6FF" opacity=".9" />
        <circle cx="20" cy="47" r="7" fill="#344054" /><circle cx="20" cy="47" r="3" fill="url(#goods-metal)" /><circle cx="47" cy="47" r="7" fill="#344054" /><circle cx="47" cy="47" r="3" fill="url(#goods-metal)" /><path d="M10 35h8" stroke="#FFF8A5" strokeWidth="3" />
      </symbol>
      <symbol id="goods-robot" viewBox="0 0 64 64">
        <path d="M32 10V5m-4 5h8" stroke="#516075" strokeWidth="3" strokeLinecap="round" /><circle cx="32" cy="5" r="3" fill="#EF5264" />
        <rect x="13" y="13" width="38" height="31" rx="8" fill="url(#goods-metal)" stroke="#465267" strokeWidth="1.4" /><rect x="18" y="18" width="28" height="18" rx="5" fill="url(#goods-cyan)" />
        <circle cx="26" cy="26" r="3" fill="#27364A" /><circle cx="38" cy="26" r="3" fill="#27364A" /><path d="M26 32h12" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
        <path d="M19 44v12m26-12v12M13 27H7v13m44-13h6v13" stroke="#66758A" strokeWidth="6" strokeLinecap="round" />
      </symbol>
      <symbol id="goods-ball" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="25" fill="url(#goods-white)" stroke="#64748B" strokeWidth="1.5" /><path d="m32 20 9 7-4 11H27l-4-11Z" fill="#334155" /><path d="m32 20 1-13m8 20 12-4M37 38l8 12M27 38 18 50m14-30-12-9M23 27 8 31" fill="none" stroke="#526174" strokeWidth="2" /><path d="m8 31 7 10-6 8m36 1 10-7-2-11M20 11l-7 10" fill="#334155" />
      </symbol>
      <symbol id="goods-palette" viewBox="0 0 64 64">
        <path d="M32 7Q8 7 7 29q-1 22 20 27 9 2 8-8-1-7 7-7 15 0 15-13Q57 7 32 7Z" fill="url(#goods-brown)" stroke="#754126" strokeWidth="1.4" /><ellipse cx="25" cy="45" rx="5" ry="4" fill="#F7D8A7" />
        <circle cx="20" cy="21" r="4" fill="#EF4558" /><circle cx="32" cy="16" r="4" fill="#FFD13C" /><circle cx="44" cy="22" r="4" fill="#39B97A" /><circle cx="46" cy="33" r="4" fill="#4B8FEF" /><circle cx="18" cy="34" r="4" fill="#8C68EE" />
      </symbol>
      <symbol id="goods-book" viewBox="0 0 64 64">
        <path d="M8 14q13-5 24 3v39q-11-8-24-3Z" fill="url(#goods-blue)" stroke="#1B559E" strokeWidth="1.4" /><path d="M56 14q-13-5-24 3v39q11-8 24-3Z" fill="url(#goods-cyan)" stroke="#1B559E" strokeWidth="1.4" /><path d="M32 17v39" stroke="#164E87" strokeWidth="2" /><path d="M13 22q8-3 14 1m-14 7q8-3 14 1m10-8q7-4 14-1m-14 8q7-4 14-1" fill="none" stroke="#E9FAFF" strokeWidth="2" strokeLinecap="round" opacity=".8" />
      </symbol>
      <symbol id="goods-guitar" viewBox="0 0 64 64">
        <path d="m37 30 13-22 7 4-15 21" fill="url(#goods-brown)" stroke="#61331F" /><path d="M38 9 53 18" stroke="#F0BC72" strokeWidth="2" />
        <path d="M38 28q-8-8-14 0-2 5-8 6-11 1-9 12 3 13 17 11 10-1 10-10 0-6 6-7 8-2-2-12Z" fill="url(#goods-orange)" stroke="#873C21" strokeWidth="1.4" /><circle cx="27" cy="40" r="6" fill="#5B3024" /><path d="m30 39 21-26" stroke="#FFF3D0" strokeWidth="1.5" />
      </symbol>
      <symbol id="goods-camera" viewBox="0 0 64 64">
        <path d="M9 20h12l4-7h17l4 7h9q4 0 4 4v27H5V24q0-4 4-4Z" fill="url(#goods-cyan)" stroke="#17667E" strokeWidth="1.4" /><path d="M5 29h54v22H5Z" fill="#30506A" opacity=".7" />
        <circle cx="32" cy="36" r="14" fill="url(#goods-metal)" /><circle cx="32" cy="36" r="9" fill="url(#goods-glass)" /><circle cx="32" cy="36" r="4" fill="#23334C" /><rect x="10" y="15" width="9" height="5" rx="2" fill="#F46B68" />
      </symbol>
      <symbol id="goods-trophy" viewBox="0 0 64 64">
        <path d="M18 8h28v13q0 17-14 20-14-3-14-20Z" fill="url(#goods-gold)" stroke="#A86510" strokeWidth="1.5" /><path d="M18 14H7q0 18 17 19M46 14h11q0 18-17 19" fill="none" stroke="#D99617" strokeWidth="5" />
        <path d="M29 40h6v9h10v8H19v-8h10Z" fill="url(#goods-orange)" stroke="#A86510" /><path d="m32 15 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#FFF1A0" />
      </symbol>
      <symbol id="goods-diamond" viewBox="0 0 64 64">
        <ellipse cx="32" cy="42" rx="16" ry="15" fill="none" stroke="url(#goods-metal)" strokeWidth="7" /><path d="m20 19 7-10h11l7 10-13 17Z" fill="url(#goods-glass)" stroke="#4E48A8" strokeWidth="1.3" /><path d="m20 19 12 3 13-3M27 9l5 13 6-13" fill="none" stroke="#E6FCFF" strokeWidth="1.4" opacity=".8" />
      </symbol>
      <symbol id="goods-key" viewBox="0 0 64 64">
        <circle cx="22" cy="22" r="14" fill="none" stroke="url(#goods-gold)" strokeWidth="8" /><path d="m31 31 24 24m-8-8 7-7m-14 0 7-7" fill="none" stroke="url(#goods-gold)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="22" cy="22" r="4" fill="#FFF1A0" />
      </symbol>
      <symbol id="goods-rocket" viewBox="0 0 64 64">
        <path d="M32 5q17 11 13 35L32 53 19 40Q15 16 32 5Z" fill="url(#goods-white)" stroke="#5C697C" strokeWidth="1.4" /><path d="M32 5q8 5 11 13H21Q24 10 32 5Z" fill="url(#goods-red)" />
        <circle cx="32" cy="28" r="7" fill="url(#goods-cyan)" stroke="#315A80" strokeWidth="2" /><path d="m19 35-9 13 12-3m23-10 9 13-12-3" fill="url(#goods-red)" stroke="#9F1D34" /><path d="m26 50 6 11 6-11" fill="url(#goods-orange)" />
      </symbol>
      <symbol id="goods-controller" viewBox="0 0 64 64">
        <path d="M17 20h30q9 1 12 20 2 14-8 15-7 1-13-10H26Q20 56 13 55 3 54 5 40q3-19 12-20Z" fill="url(#goods-purple)" stroke="#49339B" strokeWidth="1.5" />
        <path d="M19 30v14m-7-7h14" stroke="#E9E4FF" strokeWidth="4" strokeLinecap="round" /><circle cx="45" cy="33" r="3" fill="#FFCF42" /><circle cx="51" cy="40" r="3" fill="#58D6A0" /><circle cx="31" cy="39" r="2" fill="#D7CBFF" /><circle cx="37" cy="39" r="2" fill="#D7CBFF" />
      </symbol>

      {/* ── 8 Gradient Bottle Collection ── */}
      <symbol id="goods-bottle_water" viewBox="0 0 64 64">
        <rect x="26" y="8" width="12" height="7" rx="2" fill="url(#goods-cyan)" stroke="#0E7490" strokeWidth="1.2" />
        <path d="M28 15h8v5l6 7v27a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V27l6-7Z" fill="url(#goods-blue)" stroke="#1D4ED8" strokeWidth="1.4" />
        <path d="M22 34q10-4 20 0v16a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4Z" fill="url(#goods-cyan)" opacity=".85" />
        <path d="M25 20v30" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" opacity=".5" />
        <ellipse cx="32" cy="11.5" rx="5" ry="1.5" fill="#E0F2FE" />
      </symbol>

      <symbol id="goods-bottle_juice" viewBox="0 0 64 64">
        <rect x="25" y="8" width="14" height="6" rx="2" fill="url(#goods-green)" stroke="#15803D" strokeWidth="1.2" />
        <path d="M27 14h10v6l7 8v25a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V28l7-8Z" fill="url(#goods-orange)" stroke="#C2410C" strokeWidth="1.4" />
        <circle cx="32" cy="37" r="8" fill="url(#goods-yellow)" opacity=".9" />
        <path d="M32 31c4 0 6 3 6 6s-2 6-6 6-6-3-6-6 2-6 6-6Z" fill="#FFF" opacity=".4" />
        <path d="M37 11q6-5 9 1-3 5-9-1Z" fill="url(#goods-green)" stroke="#15803D" strokeWidth="1" />
        <path d="M23 22v26" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" opacity=".45" />
      </symbol>

      <symbol id="goods-bottle_soda" viewBox="0 0 64 64">
        <rect x="27" y="7" width="10" height="5" rx="1.5" fill="url(#goods-metal)" stroke="#475569" strokeWidth="1.2" />
        <path d="M29 12h6v8l7 7v25a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V27l7-7Z" fill="url(#goods-red)" stroke="#9F1239" strokeWidth="1.4" />
        <path d="M22 32q10-6 20 0v20a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4Z" fill="url(#goods-pink)" opacity=".8" />
        <circle cx="27" cy="38" r="1.8" fill="#FFF" opacity=".8" />
        <circle cx="34" cy="44" r="1.4" fill="#FFF" opacity=".8" />
        <circle cx="30" cy="48" r="1.2" fill="#FFF" opacity=".7" />
        <path d="M25 18v31" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" opacity=".4" />
      </symbol>

      <symbol id="goods-bottle_potion" viewBox="0 0 64 64">
        <path d="M27 9h10v4rx2" fill="url(#goods-brown)" stroke="#78350F" strokeWidth="1.2" />
        <rect x="28" y="7" width="8" height="6" rx="2" fill="url(#goods-yellow)" stroke="#B45309" />
        <path d="M28 13h8v10l12 12a16 16 0 1 1-32 0l12-12Z" fill="url(#goods-purple)" stroke="#581C87" strokeWidth="1.4" />
        <path d="M16 35a16 16 0 0 0 32 0q-16 4-32 0Z" fill="url(#goods-pink)" opacity=".7" />
        <polygon points="32,30 34,34 38,34 35,37 36,41 32,38 28,41 29,37 26,34 30,34" fill="#FFF" opacity=".85" />
        <path d="M22 24q-3 8 0 20" stroke="#FFF" strokeWidth="2" strokeLinecap="round" opacity=".4" />
      </symbol>

      <symbol id="goods-bottle_milk" viewBox="0 0 64 64">
        <rect x="25" y="7" width="14" height="6" rx="2" fill="url(#goods-red)" stroke="#991B1B" strokeWidth="1.2" />
        <path d="M27 13h10v6l6 6v27a4 4 0 0 1-4 4H25a4 4 0 0 1-4-4V25l6-6Z" fill="url(#goods-white)" stroke="#0284C7" strokeWidth="1.4" />
        <rect x="21" y="30" width="22" height="15" rx="3" fill="url(#goods-cyan)" opacity=".9" />
        <path d="M26 37q5-4 12 0" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 18v31" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" opacity=".35" />
      </symbol>

      <symbol id="goods-bottle_boba" viewBox="0 0 64 64">
        <line x1="38" y1="5" x2="33" y2="24" stroke="url(#goods-pink)" strokeWidth="4" strokeLinecap="round" />
        <rect x="22" y="16" width="20" height="38" rx="6" fill="url(#goods-yellow)" stroke="#B45309" strokeWidth="1.4" />
        <path d="M22 42h20v6a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6Z" fill="url(#goods-brown)" />
        <circle cx="27" cy="47" r="2.2" fill="#291810" />
        <circle cx="32" cy="49" r="2.2" fill="#291810" />
        <circle cx="37" cy="47" r="2.2" fill="#291810" />
        <circle cx="29" cy="51" r="2" fill="#291810" />
        <path d="M25 22v26" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" opacity=".4" />
      </symbol>

      <symbol id="goods-bottle_honey" viewBox="0 0 64 64">
        <rect x="26" y="8" width="12" height="6" rx="2" fill="url(#goods-brown)" stroke="#78350F" strokeWidth="1.2" />
        <path d="M27 14h10v4l7 7v23a7 7 0 0 1-7 7H27a7 7 0 0 1-7-7V25l7-7Z" fill="url(#goods-gold)" stroke="#B45309" strokeWidth="1.4" />
        <polygon points="32,30 37,33 37,39 32,42 27,39 27,33" fill="#FFF" opacity=".85" stroke="#D97706" strokeWidth="1" />
        <path d="M30 35h4m-5 3h6" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M23 22v24" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" opacity=".45" />
      </symbol>

      <symbol id="goods-bottle_energy" viewBox="0 0 64 64">
        <rect x="26" y="7" width="12" height="7" rx="2" fill="url(#goods-cyan)" stroke="#0E7490" strokeWidth="1.2" />
        <path d="M28 14h8v5l6 6v27a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V25l6-6Z" fill="url(#goods-green)" stroke="#047857" strokeWidth="1.4" />
        <polygon points="33,26 27,37 32,37 30,48 38,35 33,35" fill="url(#goods-yellow)" stroke="#D97706" strokeWidth="1" />
        <path d="M25 18v32" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" opacity=".45" />
      </symbol>
    </defs>
  </svg>
));
