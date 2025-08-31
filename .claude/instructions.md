# Claude Code Instructions for This Project

## File Modification Policy

**NEVER use the Edit or MultiEdit tools in this project. They are broken and will cause errors.**

Instead, always use this workflow:

1. **Read** the original file to understand its contents
2. **Write** a new file with `.new` extension containing your changes
3. **Use Bash** to backup the original and replace it with the new version

## Required File Replacement Workflow

When modifying any file, always follow these exact steps:

### Step 1: Create New File
```javascript
// Always create new files with .new extension
Write('/path/to/file.new.js', newContent)
```

### Step 2: Backup and Replace
```bash
# Check if backup already exists and increment if needed
if [ -f "path/to/file.backup.js" ]; then
    COUNTER=2
    while [ -f "path/to/file.backup${COUNTER}.js" ]; do
        COUNTER=$((COUNTER + 1))
    done
    BACKUP_NAME="path/to/file.backup${COUNTER}.js"
else
    BACKUP_NAME="path/to/file.backup.js"
fi

# Backup original and replace with new version
mv path/to/file.js "$BACKUP_NAME" && mv path/to/file.new.js path/to/file.js
```

### Step 3: Confirm Success
Always verify the replacement worked by reading the first few lines of the new file.

## Examples

### Modifying a JavaScript file:
```bash
# For src/app/main.js
if [ -f "src/app/main.backup.js" ]; then
    COUNTER=2
    while [ -f "src/app/main.backup${COUNTER}.js" ]; do
        COUNTER=$((COUNTER + 1))
    done
    BACKUP_NAME="src/app/main.backup${COUNTER}.js"
else
    BACKUP_NAME="src/app/main.backup.js"
fi

mv src/app/main.js "$BACKUP_NAME" && mv src/app/main.new.js src/app/main.js
```

### Modifying any file type:
```bash
# Generic pattern for any file
FILE_PATH="src/components/Component"
FILE_EXT=".tsx"

if [ -f "${FILE_PATH}.backup${FILE_EXT}" ]; then
    COUNTER=2
    while [ -f "${FILE_PATH}.backup${COUNTER}${FILE_EXT}" ]; do
        COUNTER=$((COUNTER + 1))
    done
    BACKUP_NAME="${FILE_PATH}.backup${COUNTER}${FILE_EXT}"
else
    BACKUP_NAME="${FILE_PATH}.backup${FILE_EXT}"
fi

mv "${FILE_PATH}${FILE_EXT}" "$BACKUP_NAME" && mv "${FILE_PATH}.new${FILE_EXT}" "${FILE_PATH}${FILE_EXT}"
```

## Important Notes

- **Never use Edit/MultiEdit tools** - they will fail with "file modified" errors
- **Always test the bash commands** before running them
- **User will clean up .backup files** - don't worry about managing them
- **Incremental backups** prevent overwriting existing backups (.backup, .backup2, .backup3, etc.)
- **Verify replacements** by reading the updated file after the move operation

## Directory Structure After Modifications

```
src/
├── app/
│   ├── main.js                 (current version)
│   ├── main.backup.js         (original)
│   ├── main.backup2.js        (previous modification)
│   └── main.backup3.js        (even older version)
└── components/
    ├── Component.tsx          (current)
    ├── Component.backup.tsx   (original)
    └── Component.backup2.tsx  (previous)
```

This approach ensures file modifications always work and provides a complete history of changes.