---
paths:
  - ".claude/agents/**"
---

# Agent Conventions

> Quy ước cho MỌI agent ở `.claude/agents/<name>.md` trong repo MAXV v2.
> Pipeline chuẩn và deliverable bắt buộc của từng vai: xem `.claude/CLAUDE.md`.

## Bộ agent hiện có

### Agent pipeline (7 vai — Standard Workflow)

| Vai | `name` | Phase | Model | Tools |
|---|---|---|---|---|
| Business Analyst | `business-analyst` | 1 · 2.5 (Sign-off Gate) | sonnet | Read, Write, Edit, Bash, Glob, Grep, Skill |
| Architect | `architect` | 2 | opus | Read, Write, Edit, Bash, Glob, Grep, Skill |
| Tester QA | `tester-qa` | 2 (Phase A) · 4 (Phase B) | sonnet | Read, Write, Edit, Bash, Glob, Grep, Skill |
| Backend Engineer | `backend-engineer` | 3 | sonnet | Read, Write, Edit, Bash, Glob, Grep, Skill |
| Frontend Engineer | `frontend-engineer` | 3 | sonnet | Read, Write, Edit, Bash, Glob, Grep, Skill |
| Code Reviewer | `code-reviewer` | 5 | opus | Read, Glob, Grep, Bash, Skill |
| DevOps Engineer | `devops-engineer` | 6 | sonnet | Read, Write, Edit, Bash, Glob, Grep, Skill |

### Agent review chuyên biệt (được skill spawn, không nằm trong pipeline)

| Vai | `name` | Được gọi bởi | Tools |
|---|---|---|---|
| Diagram Reviewer | `diagram-reviewer` | `/sequence`, `/activity` khi diagram vượt ngưỡng phức tạp | Read, Grep, Glob |

> Không có agent nào khác. Nếu tài liệu/skill tham chiếu tên agent không có trong 2 bảng trên, đó là tham chiếu hỏng — sửa hoặc bỏ.

## Quy ước cấp tool (quan trọng)

**Tool-set khai trong frontmatter là trần cứng.** Skill chạy bên trong subagent KHÔNG vượt qua được — skill khai `allowed-tools` rộng hơn thì phần vượt sẽ im lặng không dùng được.

- Agent nào **được khuyến nghị dùng skill sơ đồ** (`activity`, `sequence`, `erd`, `state`, `activity-swimlane`, `usecase-diagram`, `bpmn`, `d2-*`) **BẮT BUỘC có `Bash`** — mọi skill đó đều render/verify qua CLI (`mermaid-verify.mjs`, `render.sh`, `d2`, engine bpmn).
- Agent chỉ đọc/nhận xét (`code-reviewer`, `diagram-reviewer`) **KHÔNG cấp `Write`/`Edit`** — bảo đảm đúng vai "chỉ review, không tự sửa".
- **Subagent không spawn được subagent.** Skill `/sequence` và `/activity` khai `Task` để gọi `diagram-reviewer`; bước đó chỉ chạy khi skill được gọi từ session chính. Agent chạy dưới dạng subagent gặp diagram phức tạp → báo lại session chính, không tự xử.

## Trạng thái toolchain (cập nhật khi cài thêm)

| Skill | Phụ thuộc | Trạng thái |
|---|---|---|
| `activity` · `sequence` · `erd` · `state` | `mmdc` + Chrome (`~/.puppeteer-cache`) | ✅ chạy được |
| `activity-swimlane` · `usecase-diagram` | `python3` + `curl` → `plantuml.com` | ✅ chạy được (gửi nội dung sơ đồ ra ngoài — cân nhắc `plantuml.jar` local, máy đã có Java 17) |
| `d2-activity` · `d2-erd` · `d2-architect` | binary `d2` | ❌ chưa cài — skill dừng ngay bước 1 |
| `bpmn` | `.claude/skills/bpmn/engine/node_modules` | ❌ chưa cài — chạy `npm install` trong thư mục engine |

## Chuỗi trạng thái bàn giao (single source)

Chỉ dùng đúng một chuỗi, ghi trong `docs/<feature>/CONTEXT_SUMMARY.md`:

```
Status: Ready for Implementation
```

BA set chuỗi này ở Phase 2.5. `backend-engineer` và `frontend-engineer` đều chờ đúng chuỗi này ở bước 0. Không phát sinh biến thể (`Ready for Backend`, `Ready for FE`...) — lệch chuỗi = gate treo vĩnh viễn.

## Path convention

- Mọi agent dùng placeholder `docs/<feature>/...`, **không dùng `<module>`** và không hardcode tên feature.
- Cấu trúc thư mục feature: xem `.claude/CLAUDE.md` Mục 3.

## Cấu trúc file agent review

```yaml
---
name: <kebab-case>
description: 1 dòng — agent này giỏi gì và khi nào dùng
tools: <danh sách tool tối thiểu đủ dùng>
model: opus | sonnet
---

# {Persona name}

> {1 đoạn định nghĩa persona: voice, kinh nghiệm, góc nhìn.}

## Review approach      # agent review CÁI GÌ, theo thứ tự nào
## Severity rubric      # BLOCKING / WARNING / SUGGESTION cho đúng domain này
## Common findings      # lỗi điển hình, dạng checklist
## What NOT to flag     # ngoài phạm vi — chặn chồng lấn với agent khác
## Output format        # theo review-format.md
## Reference materials  # rule + doc agent cần đọc
```

## Guidelines

- **Một agent = một persona.** Không gộp BA + QA — hai lối nghĩ khác nhau.
- **Agent review thì critique, không viết lại content.** Chỉ đề xuất sửa dòng cụ thể.
- **Đúng phạm vi.** BA không phán tính khả thi kỹ thuật — đó là việc của Architect.
- **Không đếm trùng.** Đã BLOCKING thì không lặp lại thành WARNING; lấy mức cao nhất.
- **Finding nguyên tử.** Mỗi finding 1 vấn đề + 1 đề xuất sửa. Finding gộp thì tách ra.
- **Không giả định vai trước đã xong.** Luôn kiểm chứng artifact/evidence (xem "Final Principle" trong CLAUDE.md).
