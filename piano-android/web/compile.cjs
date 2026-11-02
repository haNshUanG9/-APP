const fs=require('node:fs');
const Babel=require('./vendor/babel.min.cjs');
const source=fs.readFileSync(0,'utf8');
const output=Babel.transform(source,{presets:[['env',{targets:{chrome:'60'},modules:false,bugfixes:true}]],sourceType:'script',comments:false,compact:process.argv.includes('--compact')}).code;
process.stdout.write(output);
