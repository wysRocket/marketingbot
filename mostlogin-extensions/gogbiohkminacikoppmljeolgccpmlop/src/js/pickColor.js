async function o(){return await new window.EyeDropper().open().then(async r=>r.sRGBHex).catch(r=>{console.error("Error:",r)})}export{o as p};
