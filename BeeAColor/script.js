async function loadCSV() {
  const response = await fetch('input.csv');
  const data = await response.text();

  const rows = data.split('\n').slice(1);
  const parsed = rows.map(row => {
    const cols = row.split(',');
    return {
      categoria: cols[0],
      titulo: cols[1],
      descripcion: cols[2],
      path: cols[3]
    };
  });

  buildSections(parsed);
}

function buildSections(data) {
  const container = document.getElementById('dynamic-sections');

  // Agrupar por categoría
  const categorias = {};

  data.forEach(item => {
    if (!categorias[item.categoria]) {
      categorias[item.categoria] = [];
    }
    categorias[item.categoria].push(item);
  });

  // Crear secciones
  Object.keys(categorias).forEach(cat => {

    const section = document.createElement('section');
    section.className = 'panel category';

    const title = document.createElement('h2');
    title.innerText = cat;

    const slider = document.createElement('div');
    slider.className = 'slider';

    const track = document.createElement('div');
    track.className = 'slider-track';

    categorias[cat].forEach(item => {
      const img = document.createElement('img');
      img.src = `assets/img/${item.path}`;
      track.appendChild(img);
    });

    // duplicar para efecto infinito
    track.innerHTML += track.innerHTML;

    slider.appendChild(track);

    const desc = document.createElement('p');
    desc.innerText = categorias[cat][0].descripcion;

    const btn = document.createElement('button');
    btn.innerText = 'Cotiza';
    btn.onclick = () => {
      alert('Contacto para cotización');
    };

    section.appendChild(title);
    section.appendChild(slider);
    section.appendChild(desc);
    section.appendChild(btn);

    container.appendChild(section);
  });
}

loadCSV();
