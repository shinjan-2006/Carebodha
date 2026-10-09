import {isLanguage,type Language} from "./languages";

// This is an interface message, never an automatic translation of medical advice.
const notices:Record<Language,string>={
 en:"An approved translation is not available. Please ask your care team for a reviewed translation.",
 hi:"इस भाषा में स्वीकृत अनुवाद उपलब्ध नहीं है। कृपया अपनी देखभाल टीम से समीक्षा किया हुआ अनुवाद माँगें।",
 bn:"এই ভাষায় অনুমোদিত অনুবাদ নেই। আপনার চিকিৎসা দলের কাছে পর্যালোচিত অনুবাদ চাইুন।",
 or:"ଏହି ଭାଷାରେ ଅନୁମୋଦିତ ଅନୁବାଦ ଉପଲବ୍ଧ ନାହିଁ। ଦୟାକରି ଆପଣଙ୍କ ଚିକିତ୍ସା ଦଳକୁ ସମୀକ୍ଷିତ ଅନୁବାଦ ମାଗନ୍ତୁ।",
 te:"ఈ భాషలో ఆమోదించిన అనువాదం అందుబాటులో లేదు. సమీక్షించిన అనువాదం కోసం మీ వైద్య బృందాన్ని అడగండి.",
 pa:"ਇਸ ਭਾਸ਼ਾ ਵਿੱਚ ਮਨਜ਼ੂਰ ਕੀਤਾ ਅਨੁਵਾਦ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਦੇਖਭਾਲ ਟੀਮ ਤੋਂ ਸਮੀਖਿਆ ਕੀਤਾ ਅਨੁਵਾਦ ਮੰਗੋ।",
 ta:"இந்த மொழியில் அங்கீகரிக்கப்பட்ட மொழிபெயர்ப்பு இல்லை. மதிப்பாய்வு செய்த மொழிபெயர்ப்பை உங்கள் மருத்துவக் குழுவிடம் கேளுங்கள்."
};
export function translationAudioNotice(language:string){return notices[isLanguage(language)?language:"en"];}
