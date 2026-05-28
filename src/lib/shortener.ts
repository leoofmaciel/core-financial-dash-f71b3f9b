export async function shortenUrl(longUrl: string): Promise<string> {
  return new Promise((resolve) => {
    // Usamos JSONP com o is.gd porque ele contorna os bloqueios de CORS dos navegadores
    // de forma 100% segura e confiável, sem precisar de servidores proxy!
    
    const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
    
    // @ts-ignore
    window[callbackName] = function(data: any) {
      // @ts-ignore
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      
      if (data && data.shorturl) {
        resolve(data.shorturl);
      } else {
        resolve(longUrl);
      }
    };

    const script = document.createElement('script');
    script.src = `https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}&callback=${callbackName}`;
    
    script.onerror = () => {
      // @ts-ignore
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      resolve(longUrl);
    };
    
    document.body.appendChild(script);
    
    // Timeout de 5 segundos
    setTimeout(() => {
      // @ts-ignore
      if (window[callbackName]) {
        // @ts-ignore
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
        resolve(longUrl);
      }
    }, 5000);
  });
}
