function generateWaveDivider(svgID, waveCount, amplitude, color1, color2, alpha1, alpha2) {
    let svg = document.querySelector(svgID);
    let height = svg.getBoundingClientRect().height;
    let minHeight = amplitude / 2;
    let maxHeight = height - minHeight;
    for (let i = 0; i < waveCount; i++) {
        let newPath = document.createElementNS('http://www.w3.org/2000/svg',"path");  
        svg.appendChild(newPath);

        let interp = i/(waveCount-1);
        let waveHeight = minHeight * (1.0 - interp) + maxHeight * interp;
        let color = _interpolateColor(color1, color2, interp);
        let alpha = alpha1 * (1.0 - interp) + alpha2 * interp;

        let newWave = wavify( newPath, {
            height: waveHeight,
            bones: 3 + Math.round(Math.random() * 5),
            amplitude: amplitude * (1-i/waveCount),
            color: 'rgba(' + color[0] + ', ' + color[1] + ', ' + color[2] + ', ' + alpha + ')',
            speed: .1 + 0.15 * interp,
            timeOffset: Math.random() * 100
        })
    }
}