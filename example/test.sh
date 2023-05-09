
if ! npm run test | grep -q 'Hello ComponentizeJS'; then
  exit 1
fi
