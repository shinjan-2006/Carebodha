/** A code-native still of the segmented ribbon; always available without WebGL. */
export function RibbonFallback() {
  return <svg className="static-ribbon" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="ribbon-glass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f8f9ff"/><stop offset=".45" stopColor="#c1c9df" stopOpacity=".6"/><stop offset=".7" stopColor="#8799c0" stopOpacity=".4"/><stop offset="1" stopColor="#edf0f8"/></linearGradient></defs>
    {Array.from({length:88},(_,j)=>{const s=j/87,x=-70+s*1650,y=70+s*630+85*Math.sin(s*6.28),angle=25+18*Math.sin(s*8);return <g key={j} transform={`translate(${x} ${y}) rotate(${angle})`}>{Array.from({length:6},(_,k)=><rect key={k} x={-100+k*34} y="-13" width="32" height="72" rx="5" fill="url(#ribbon-glass)" stroke={k===2?"#8390ad":"#ffffff"} strokeOpacity=".6" opacity=".78"/>)}</g>;})}
  </svg>;
}
