#!/bin/bash
# Validation script for instruction files refactoring
# Checks: overlap detection, file sizes, rule preservation

set -e

INSTRUCTIONS_DIR=".github/instructions"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Instruction Files Validation ==="
echo ""

# Check 1: File sizes
echo "✓ File Size Check (<3KB except financial-calculations at 4KB):"
echo ""
max_size_normal=3000
max_size_financial=4000
violations=0

for file in "$INSTRUCTIONS_DIR"/*.instructions.md; do
  size=$(wc -c < "$file")
  filename=$(basename "$file")
  
  if [[ "$filename" == "financial-calculations.instructions.md" ]]; then
    if [ "$size" -gt "$max_size_financial" ]; then
      echo -e "${RED}✗ $filename: ${size} bytes (max $max_size_financial)${NC}"
      violations=$((violations + 1))
    else
      echo -e "${GREEN}✓ $filename: ${size} bytes${NC}"
    fi
  else
    if [ "$size" -gt "$max_size_normal" ]; then
      echo -e "${RED}✗ $filename: ${size} bytes (max $max_size_normal)${NC}"
      violations=$((violations + 1))
    else
      echo -e "${GREEN}✓ $filename: ${size} bytes${NC}"
    fi
  fi
done

echo ""

# Check 2: Overlap detection
echo "✓ applyTo Overlap Check (should be zero):"
echo ""
overlaps=0

# Extract all applyTo patterns
declare -A paths_to_files
declare -a all_patterns

while IFS= read -r file; do
  # Extract applyTo patterns
  patterns=$(grep -h "^applyTo:" "$file" 2>/dev/null | sed 's/applyTo: "\(.*\)"/\1/' || true)
  if [ -z "$patterns" ]; then
    continue
  fi
  
  filename=$(basename "$file")
  
  # Split comma-separated patterns
  IFS=',' read -ra pattern_array <<< "$patterns"
  for pattern in "${pattern_array[@]}"; do
    pattern=$(echo "$pattern" | xargs) # trim whitespace
    key="${pattern}:${filename}"
    
    if [[ -v "paths_to_files[$pattern]" ]]; then
      echo -e "${RED}✗ OVERLAP: Pattern '$pattern' found in:"
      echo "  - ${paths_to_files[$pattern]}"
      echo "  - $filename"
      overlaps=$((overlaps + 1))
    else
      paths_to_files["$pattern"]="$filename"
    fi
  done
done < <(find "$INSTRUCTIONS_DIR" -name "*.instructions.md" -type f | sort)

if [ "$overlaps" -eq 0 ]; then
  echo -e "${GREEN}✓ No overlapping applyTo patterns found${NC}"
else
  violations=$((violations + overlaps))
fi

echo ""

# Check 3: Expected files exist
echo "✓ Expected Files Check:"
echo ""
expected_files=(
  "react-components.instructions.md"
  "hooks-state-providers.instructions.md"
  "financial-calculations.instructions.md"
  "testing.instructions.md"
  "backend-api.instructions.md"
  "infrastructure.instructions.md"
  "styling-tokens.instructions.md"
)

missing=0
for file in "${expected_files[@]}"; do
  if [ -f "$INSTRUCTIONS_DIR/$file" ]; then
    echo -e "${GREEN}✓ $file exists${NC}"
  else
    echo -e "${RED}✗ $file MISSING${NC}"
    missing=$((missing + 1))
    violations=$((violations + 1))
  fi
done

echo ""

# Check 4: Old files deleted
echo "✓ Deprecated Files Deletion Check:"
echo ""
deprecated_files=(
  "anti-slop-quality.instructions.md"
  "validation-loops.instructions.md"
  "efficiency-performance.instructions.md"
  "react-best-practices.instructions.md"
  "react-composition-patterns.instructions.md"
  "frontend-design.instructions.md"
  "web-interface-guidelines.instructions.md"
  "ui-colors.instructions.md"
  "css-tailwind.instructions.md"
  "financial-forecasting.instructions.md"
  "financial-math-guardian.instructions.md"
  "hooks-and-state.instructions.md"
  "webapp-testing.instructions.md"
  "design-tokens.instructions.md"
)

still_present=0
for file in "${deprecated_files[@]}"; do
  if [ -f "$INSTRUCTIONS_DIR/$file" ]; then
    echo -e "${YELLOW}⚠ $file still present (ready to delete)${NC}"
    still_present=$((still_present + 1))
  fi
done

if [ "$still_present" -eq 0 ]; then
  echo -e "${GREEN}✓ All deprecated files deleted${NC}"
else
  echo -e "${YELLOW}⚠ $still_present deprecated files still present${NC}"
fi

echo ""

# Summary
echo "=== VALIDATION SUMMARY ==="
if [ "$violations" -eq 0 ]; then
  echo -e "${GREEN}✓ ALL CHECKS PASSED${NC}"
  exit 0
else
  echo -e "${RED}✗ $violations violation(s) found${NC}"
  exit 1
fi
