let cols = 20;
let rows = 20;
let w = 20; // cell width
let grid = [];

let terrainCosts = [Infinity, 1, 5, 10];
let terrainColors = [
  '#000000',
  '#f7f7f7',
  '#f4a582',
  '#0571b0'
];

let agent, food;
let agent_start;
let searchTypeSelect;
let searchTypes = ['BFS', 'DFS', 'UCS', 'Greedy', "A*"];

let state = 'idle';
let openSet = [];
let closedSet = new Set();
let cameFrom = {};
let gScore = {};
let path = [];
let moveIndex = 0;
let moveTimer = 0;

function setup() {
  createCanvas(cols * w + 100, rows * w);
  frameRate(30);
  generateGrid();
  createUI();
  resetSimulation();
}

function key_function(cell) {
  return cell.x + '-' + cell.y;
}

function draw() {
  background(220);
  drawGrid();
  drawSearchHighlights();
  drawAgentAndFood();

  if (state === 'searching') {
    stepSearch();
  } else if (state === 'moving') {
    animateAgent();
  }
}

// generate random grid
// defining probs for each terrain tpye
function generateGrid() {
  grid = [];
  for (let i = 0; i < cols; i++) {
    grid[i] = [];
    for (let j = 0; j < rows; j++) {
      let r = random();
      let type;
      if (r < 0.1) type = 0;
      else if (r < 0.5) type = 1;
      else if (r < 0.8) type = 2;
      else type = 3;
      grid[i][j] = type;
    }
  }
  
  agent_start = randomEmptyCell();
  food = randomEmptyCell();
}

// ui for selecting search type
function createUI() {
  searchTypeSelect = createSelect();
  searchTypeSelect.position(cols * w + 20, 20);
  searchTypes.forEach(t => searchTypeSelect.option(t));
  searchTypeSelect.changed(resetSimulation);

  let btnNewMap = createButton('New Map');
  btnNewMap.position(cols * w + 20, 60);
  btnNewMap.mousePressed(() => {
    generateGrid();
    resetSimulation();
  });
}

function resetSimulation() {
  closedSet.clear();
  cameFrom = {};
  gScore = {};
  path = [];
  moveIndex = 0;
  moveTimer = 0;
  state = 'idle';

  agent = agent_start
  food = randomEmptyCell();
  // food = randomEmptyCell();
  initializeSearch();
}

// pick non obstacle cell
function randomEmptyCell() {
  let x, y;
  do {
    x = floor(random(cols));
    y = floor(random(rows));
  } while (grid[x][y] === 0);
  
  return { x, y };
}

function drawGrid() {
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      fill(terrainColors[grid[i][j]]);
      stroke(200);
      rect(i * w, j * w, w, w);
    }
  }
}

function drawAgentAndFood() {
  // food
  fill('#FF0000');
  rect(food.x * w + w*0.2, food.y * w + w*0.2, w*0.6, w*0.6);

  // agent
  fill('#00FF00');
  ellipse(agent.x * w + w/2, agent.y * w + w/2, w*0.6);
}

function drawSearchHighlights() {
  // frontier
  for (let node of openSet) {
    fill('rgba(0,255,255,0.4)');
    rect(node.x * w, node.y * w, w, w);
  }

  closedSet.forEach(key => {
    let [i,j] = key.split('-').map(Number);
    fill('rgba(200,200,200,0.4)');
    rect(i * w, j * w, w, w);
  });
  // Path
  if (path.length > 0) {
    push();
    stroke('#f33');
    strokeWeight(w * 0.2);
    beginShape();
    let drawPath = [agent_start, ...path]
    for (let p of drawPath) {
      vertex(p.x * w + w / 2, p.y * w + w / 2);
    }
    endShape();
    pop();
    
    push();
    fill(0, 255, 0, 100);
    noStroke();
    ellipse(agent_start.x * w + w / 2, agent_start.y * w + w / 2, w * 0.5);
    pop();
  }
}

// prepare data structures for the chosen search
function initializeSearch() {
  openSet = [];
  closedSet.clear();
  cameFrom = {};
  gScore = {};
  path = [];
  state = 'searching';

  let startKey = key_function(agent);
  gScore[startKey] = 0;
  openSet.push({ ...agent, priority: 0 });
}

// perform one it of the search
function stepSearch() {
  if (openSet.length === 0) {
    state = 'idle'; // no path
    return;
  }
  // select node based on search type
  let current;
  let type = searchTypeSelect.value();
  if (type === 'BFS') {
    current = openSet.shift();
  } else if (type === 'DFS') {
    current = openSet.pop();
  } else {
    // ucs, greedy, A*
    openSet.sort((a,b) => a.priority - b.priority);
    current = openSet.shift();
  }
  let curKey = key_function(current);
  let foodKey = key_function(food);
  if (closedSet.has(curKey)) return;
  closedSet.add(curKey);

  // check if goal
  if (current.x === food.x && current.y === food.y) {
    current_key = key_function(current);
    
    print("cost " + gScore[current_key]);
    reconstructPath(curKey);
    state = 'moving';
    return;
  }

  // expand neighbors
  let neighbors = getNeighbors(current);
  for (let nbr of neighbors) {
    let nbrKey = key_function(nbr);
    if (closedSet.has(nbrKey)) continue;
    let tentativeG;
    if (foodKey === nbrKey) {
      tentativeG = gScore[curKey];
    } else {
     tentativeG = gScore[curKey] + terrainCosts[grid[nbr.x][nbr.y]]; 
    }
    let better = gScore[nbrKey] === undefined || tentativeG < gScore[nbrKey];
    if (better) {
      cameFrom[nbrKey] = curKey;  // best immediate 
      gScore[nbrKey] = tentativeG;
      let h = heuristic(nbr, food);
      let priority;
      if (type === 'UCS') priority = tentativeG;
      else if (type === 'Greedy') priority = h;
      else if (type === "A*") priority = tentativeG + h;
      else priority = 0;
      openSet.push({ x: nbr.x, y: nbr.y, priority });
    }
  }
}

// get valid neighbor cells (4-directional)
function getNeighbors(node) {
  let dirs = [ [1,0],[-1,0],[0,1],[0,-1] ];
  let res = [];
  for (let d of dirs) {
    let nx = node.x + d[0];
    let ny = node.y + d[1];
    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && grid[nx][ny] !== 0) {
      res.push({ x: nx, y: ny });
    }
  }
  return res;
}

// using it for the A* algo -> manhattan distance
function heuristic(a, b) {
    return abs(a.x - b.x) + abs(a.y - b.y);
}

function reconstructPath(goalKey) {
  let curr = goalKey;
  path = [];
  while (curr !== key_function(agent)) {
    let parts = curr.split('-').map(Number);
    path.push({ x: parts[0], y: parts[1] });
    curr = cameFrom[curr];
  }
  
  path.reverse();
}

function animateAgent() {
  if (moveIndex >= path.length) {
    // collected food
    agent_start = food;
    resetSimulation();
    return;
  }
  let next = path[moveIndex];
  let cost = terrainCosts[grid[next.x][next.y]];
  if (moveTimer < cost * 2) {
    moveTimer++;
    return;
  }
  moveTimer = 0;
  agent = next;
  moveIndex++;
}