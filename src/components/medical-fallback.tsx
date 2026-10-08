/** Readable silhouettes for reduced motion and devices without WebGL. */
export function MedicalFallback({active=0,collection=false}:{active?:number;collection?:boolean}) {
  return <div className={`medical-fallback${collection?" medical-collection":""}`} data-active={active}>
    <svg className="equipment-stethoscope" viewBox="0 0 240 270" fill="none" aria-hidden="true">
      <path d="M65 36C42 83 54 122 103 126M143 36C165 83 154 122 103 126" stroke="#8794aa" strokeWidth="8" strokeLinecap="round"/>
      <path d="M104 126V208C104 261 189 262 189 203V141" stroke="#234ee0" strokeWidth="14" strokeLinecap="round"/>
      <path d="M64 35L70 26M144 35L138 26" stroke="#18233a" strokeWidth="14" strokeLinecap="round"/>
      <circle cx="189" cy="126" r="29" fill="#edf0f7" stroke="#8794aa" strokeWidth="7"/><circle cx="189" cy="126" r="19" stroke="#bbc4d4" strokeWidth="2"/>
    </svg>
    <svg className="equipment-monitor" viewBox="0 0 280 240" fill="none" aria-hidden="true">
      <rect x="99" y="31" width="166" height="151" rx="25" fill="#faf9f6" stroke="#8794aa" strokeWidth="3"/><rect x="120" y="52" width="122" height="73" rx="8" fill="#d7e0ec" stroke="#18233a" strokeWidth="6"/>
      <path d="M151 75H169M188 75H206M151 101H169M188 101H206" stroke="#18233a" strokeWidth="6"/><circle cx="150" cy="153" r="7" fill="#8794aa"/><rect x="183" y="147" width="43" height="13" rx="6" fill="#234ee0"/>
      <path d="M101 154C105 227 52 236 46 176" stroke="#18233a" strokeWidth="6"/><rect x="15" y="70" width="62" height="109" rx="18" fill="#234ee0" transform="rotate(-12 46 124)"/><path d="M17 102L70 90" stroke="#faf9f6" strokeWidth="16"/>
    </svg>
    <svg className="equipment-iv" viewBox="0 0 230 290" fill="none" aria-hidden="true">
      <path d="M82 266V20H151V36M82 249L36 271M82 249L128 271" stroke="#8794aa" strokeWidth="6" strokeLinecap="round"/>
      <rect x="119" y="36" width="63" height="94" rx="12" fill="#e4e9fb" stroke="#8794aa" strokeWidth="3"/><path d="M124 92H177V118H124Z" fill="#c7d5ed"/><rect x="131" y="56" width="40" height="26" rx="3" fill="#faf9f6"/>
      <path d="M150 130V159C169 177 166 212 167 244" stroke="#8794aa" strokeWidth="3"/><rect x="157" y="199" width="16" height="23" rx="4" fill="#234ee0"/><circle cx="36" cy="272" r="8" fill="#18233a"/><circle cx="128" cy="272" r="8" fill="#18233a"/>
    </svg>
  </div>;
}
