import fs from 'fs';
const f="src/app/chat/ChatClient.tsx";
let s=fs.readFileSync(f,'utf8'); const before=s;

// 1) /api/rtc/init  ->  /api/anon/init
s=s.replace(/fetch\((['"])\s*\/api\/rtc\/init\s*\1/g,"fetch($1/api/anon/init$1)");

// 2) إزالة شرط الكوكي وتشغيل ui:next مباشرة
const r=/if\s*\(\s*document\.cookie\.includes\(\s*(['"])anon=\1\s*\)\s*\)\s*\{\s*emit\(\s*(['"])ui:next\2\s*\);\s*console\.log\([^)]*AUTO_NEXT[^)]*\);\s*\}\s*else\s*\{\s*console\.log\([^)]*\);\s*\}/s;
if(r.test(s)){
  s=s.replace(r, "emit('ui:next'); console.log('AUTO_NEXT: fired');");
} else {
  s=s.replace(/document\.cookie\.includes\(\s*(['"])anon=\1\s*\)/g,'true')
     .replace(/else\s*\{[^}]*\}/g,'');
}

if(s!==before){ fs.writeFileSync(f,s); console.log("PATCHED: ChatClient.tsx"); }
else { console.log("NO_CHANGE: ChatClient.tsx"); }
