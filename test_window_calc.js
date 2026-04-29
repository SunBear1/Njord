// Test window slicing logic
const CALIBRATION_DAYS = 504;
const TEST_DAYS = 252;
const TOTAL_DAYS_NEEDED = CALIBRATION_DAYS + TEST_DAYS; // 756

console.log("=== Testing window slicing ===\n");

// Simulate prices array with 3000 elements
const mockPrices = new Array(3000).fill(0).map((_, i) => i);

// Test 1: Latest window (offsetDays = 0)
console.log("Test 1: Latest window (offsetDays = 0)");
let offsetDays = 0;
let needed = TOTAL_DAYS_NEEDED + offsetDays; // 756
let window = mockPrices.slice(mockPrices.length - needed, mockPrices.length - offsetDays);
console.log(`  needed = ${needed}`);
console.log(`  window.length = ${window.length}`);
console.log(`  window[0] = ${window[0]}, window[${window.length - 1}] = ${window[window.length - 1]}`);
console.log(`  calibPrices would be: window.slice(0, 505) → indices 0-504`);
console.log(`  testStart = window[504] = ${window[504]}`);
console.log(`  testEnd = window[755] = ${window[755]}`);
console.log(`  Test span: from index 504 to 755 = ${755 - 504} intervals = 251 trading days\n`);

// Test 2: 1yr-ago window (offsetDays = 252)
console.log("Test 2: 1yr-ago window (offsetDays = 252)");
offsetDays = 252;
needed = TOTAL_DAYS_NEEDED + offsetDays; // 1008
window = mockPrices.slice(mockPrices.length - needed, mockPrices.length - offsetDays);
console.log(`  needed = ${needed}`);
console.log(`  window.length = ${window.length}`);
console.log(`  window[0] = ${window[0]}, window[${window.length - 1}] = ${window[window.length - 1]}`);
console.log(`  testStart = window[504] = ${window[504]}`);
console.log(`  testEnd = window[755] = ${window[755]}`);
console.log(`  Test span: from index 504 to 755 = ${755 - 504} intervals = 251 trading days\n`);

// Test 3: 2yr-ago window (offsetDays = 504)
console.log("Test 3: 2yr-ago window (offsetDays = 504)");
offsetDays = 504;
needed = TOTAL_DAYS_NEEDED + offsetDays; // 1260
window = mockPrices.slice(mockPrices.length - needed, mockPrices.length - offsetDays);
console.log(`  needed = ${needed}`);
console.log(`  window.length = ${window.length}`);
console.log(`  window[0] = ${window[0]}, window[${window.length - 1}] = ${window[window.length - 1]}`);
console.log(`  testStart = window[504] = ${window[504]}`);
console.log(`  testEnd = window[755] = ${window[755]}`);
console.log(`  Test span: from index 504 to 755 = ${755 - 504} intervals = 251 trading days\n`);
