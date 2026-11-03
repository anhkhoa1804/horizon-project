# PlatformIO prebuild: preserve the original station source filenames while
# giving the Windows Xtensa preprocessor an ASCII include path.
from pathlib import Path
Import("env")
root=Path(env.subst("$PROJECT_DIR"))
generated=root/"build_entries"/"generated"
generated.mkdir(parents=True,exist_ok=True)
for number in (1,2):
    text=(root/"src"/f"trạm {number}.ino").read_text(encoding="utf-8")
    text=text.replace('#include "shared/', '#include "../../src/shared/')
    (generated/f"station{number}.h").write_text(text,encoding="utf-8")
