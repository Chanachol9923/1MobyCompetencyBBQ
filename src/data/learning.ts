/**
 * LMS content model.
 *
 * Everything here is additive over the phase-1 shape: `COURSES`, `BADGES`,
 * `REWARDS`, `POINT_RULES`, `ANNOUNCEMENTS` and `ACHIEVEMENTS` keep their names
 * and their existing fields so the admin screens and the store keep compiling.
 * New in phase 2:
 *   - Thai copy on every course and chapter (`titleTh`, `descriptionTh`, ...)
 *   - a content type per chapter (`kind`: video | pdf | article)
 *   - `LEARNING_PATHS` — the requirement's "Learning Path" (5 courses + 1 project)
 */

/* ------------------------------------------------------------- content type */

export type ChapterKind = "video" | "pdf" | "article";

export const CHAPTER_KINDS: ChapterKind[] = ["video", "pdf", "article"];

export const CHAPTER_KIND_LABEL: Record<ChapterKind, { en: string; th: string }> = {
  video: { en: "Video", th: "วิดีโอ" },
  pdf: { en: "PDF", th: "เอกสาร PDF" },
  article: { en: "Article", th: "บทความ" },
};

export type Chapter = {
  id: string;
  title: string;
  titleTh?: string;
  minutes: number;
  summary: string;
  summaryTh?: string;
  bullets: string[];
  bulletsTh?: string[];
  /** content type — chapters authored before phase 2 default to "video" */
  kind?: ChapterKind;
  /** page count, only meaningful when kind === "pdf" */
  pages?: number;
  /** article body, only meaningful when kind === "article" */
  body?: string;
  bodyTh?: string;
};

/** Content type of a chapter, with the legacy default applied. */
export const chapterKind = (ch: Chapter): ChapterKind => ch.kind ?? "video";

/** Distinct content types inside a course, in a stable order. */
export const courseKinds = (c: Course): ChapterKind[] =>
  CHAPTER_KINDS.filter((k) => c.chapters.some((ch) => chapterKind(ch) === k));

export type Course = {
  id: string;
  title: string;
  titleTh?: string;
  category: "Core" | "Functional" | "Managerial";
  competencyId: string;
  hours: number;
  lessons: number;
  enrolled: number;
  status: "Published" | "Draft";
  cover: string; // tailwind gradient classes
  description: string;
  descriptionTh?: string;
  chapters: Chapter[];
};

export const COURSES: Course[] = [
  {
    id: "leadership-team-dynamics",
    title: "Leadership and Team Dynamics",
    titleTh: "ภาวะผู้นำและพลวัตของทีม",
    category: "Managerial",
    competencyId: "process",
    hours: 18,
    lessons: 6,
    enrolled: 42,
    status: "Published",
    cover: "from-[#006bff] to-[#0b1b3f]",
    description:
      "How high-performing teams actually run: shared standards, feedback loops, and the meetings worth keeping.",
    descriptionTh:
      "ทีมที่ทำผลงานได้ดีทำงานกันอย่างไรจริง ๆ ทั้งมาตรฐานร่วม วงจรการให้ฟีดแบ็ก และการประชุมที่ควรเก็บไว้",
    chapters: [
      {
        id: "c4",
        title: "Radical Listening",
        titleTh: "การฟังอย่างตั้งใจจริง",
        kind: "video",
        minutes: 12,
        summary: "Great ideas mean nothing if you cannot communicate them effectively.",
        summaryTh: "ความคิดที่ดีไม่มีความหมาย ถ้าสื่อสารออกไปไม่ได้",
        bullets: [
          "Articulates ideas clearly and concisely across different platforms.",
          "Demonstrates active listening by summarizing and validating others' input.",
          "Adapts communication style to suit diverse audiences and situations.",
          "Manages emotional responses effectively during difficult conversations.",
        ],
        bulletsTh: [
          "สื่อสารความคิดได้ชัดเจนและกระชับในทุกช่องทาง",
          "แสดงการฟังเชิงรุกด้วยการสรุปและทวนความเข้าใจของผู้อื่น",
          "ปรับรูปแบบการสื่อสารให้เหมาะกับผู้ฟังและสถานการณ์",
          "จัดการอารมณ์ของตนเองได้ดีในบทสนทนาที่ยาก",
        ],
      },
      {
        id: "c5",
        title: "The Chameleon Method",
        titleTh: "วิธีกิ้งก่า: ปรับโทน ไม่เปลี่ยนสาร",
        kind: "article",
        minutes: 15,
        summary: "Adjust your register without losing your message.",
        summaryTh: "ปรับระดับภาษาโดยไม่ทำให้สารที่ต้องการสื่อหายไป",
        body:
          "A supervisor speaks to four audiences in a single day: the team, a peer lead, the manager above, and the customer. The message stays the same; the register does not. Start by naming what the listener needs to decide — an engineer needs the constraint, a manager needs the risk, a customer needs the date. Then choose the shortest form of the argument that still supports that decision. When the framing moves, the core claim must stay verifiable in every version, otherwise you are not adapting, you are drifting.",
        bodyTh:
          "หัวหน้างานคนหนึ่งพูดกับผู้ฟังสี่กลุ่มในวันเดียว ทั้งทีมของตนเอง หัวหน้าทีมข้างเคียง ผู้จัดการเหนือขึ้นไป และลูกค้า สารหลักเหมือนเดิม แต่ระดับภาษาไม่เหมือนกัน เริ่มจากการระบุว่าผู้ฟังต้องตัดสินใจอะไร วิศวกรต้องการเงื่อนไขทางเทคนิค ผู้จัดการต้องการความเสี่ยง ลูกค้าต้องการกำหนดวัน จากนั้นเลือกรูปแบบที่สั้นที่สุดที่ยังพอให้ตัดสินใจได้ เมื่อกรอบการเล่าเปลี่ยน ข้อความหลักต้องยังตรวจสอบได้เหมือนกันทุกเวอร์ชัน ไม่เช่นนั้นไม่ใช่การปรับตัว แต่คือการเลื่อนไหลของสาร",
        bullets: [
          "Reads the room before choosing a delivery style.",
          "Translates technical detail for non-technical stakeholders.",
          "Keeps the core argument stable while the framing moves.",
        ],
        bulletsTh: [
          "อ่านบรรยากาศของผู้ฟังก่อนเลือกวิธีนำเสนอ",
          "แปลงรายละเอียดเชิงเทคนิคให้ผู้ที่ไม่ใช่สายเทคนิคเข้าใจได้",
          "รักษาสาระหลักให้คงเดิมแม้จะเปลี่ยนวิธีเล่า",
        ],
      },
      {
        id: "c6",
        title: "Emotional Intelligence in Dialogue",
        titleTh: "ความฉลาดทางอารมณ์ในบทสนทนา",
        kind: "video",
        minutes: 18,
        summary: "Notice the signal under the sentence.",
        summaryTh: "จับสัญญาณที่ซ่อนอยู่ใต้ประโยค",
        bullets: [
          "Names the emotion before responding to the content.",
          "Separates the person from the problem in conflict.",
          "Closes conversations with an explicit shared next step.",
        ],
        bulletsTh: [
          "ระบุอารมณ์ที่เกิดขึ้นก่อนจะตอบเนื้อหา",
          "แยกตัวบุคคลออกจากตัวปัญหาเมื่อเกิดความขัดแย้ง",
          "ปิดบทสนทนาด้วยขั้นตอนถัดไปที่ตกลงร่วมกันอย่างชัดเจน",
        ],
      },
    ],
  },
  {
    id: "project-management-essentials",
    title: "Project Management Essentials",
    titleTh: "พื้นฐานการบริหารโครงการ",
    category: "Managerial",
    competencyId: "people",
    hours: 10,
    lessons: 5,
    enrolled: 31,
    status: "Published",
    cover: "from-[#f05123] to-[#faa21b]",
    description: "Scope, sequence, and the discipline of saying no on time.",
    descriptionTh: "ขอบเขตงาน ลำดับงาน และวินัยในการปฏิเสธให้ทันเวลา",
    chapters: [
      {
        id: "p1",
        title: "Scoping Without Guessing",
        titleTh: "กำหนดขอบเขตโดยไม่ต้องเดา",
        kind: "video",
        minutes: 14,
        summary: "A scope you cannot draw is a scope you cannot deliver.",
        summaryTh: "ขอบเขตที่วาดออกมาไม่ได้ คือขอบเขตที่ส่งมอบไม่ได้",
        bullets: [
          "Turns a vague ask into a written, testable outcome.",
          "Separates must-have from nice-to-have before estimating.",
          "Documents assumptions so they can be challenged early.",
        ],
        bulletsTh: [
          "เปลี่ยนคำขอที่คลุมเครือให้เป็นผลลัพธ์ที่เขียนและทดสอบได้",
          "แยกสิ่งที่จำเป็นออกจากสิ่งที่มีก็ดีก่อนเริ่มประเมินเวลา",
          "บันทึกข้อสมมติไว้เพื่อให้ถูกตั้งคำถามได้ตั้งแต่ต้น",
        ],
      },
      {
        id: "p2",
        title: "Estimation and Buffers",
        titleTh: "การประเมินเวลาและการกันเวลาสำรอง",
        kind: "pdf",
        pages: 14,
        minutes: 11,
        summary: "Estimates are ranges, not promises.",
        summaryTh: "การประเมินคือช่วงเวลา ไม่ใช่คำสัญญา",
        bullets: [
          "Estimates in ranges tied to explicit confidence.",
          "Adds buffer where uncertainty lives, not uniformly.",
          "Re-estimates when the scope actually changes.",
        ],
        bulletsTh: [
          "ประเมินเป็นช่วงพร้อมระบุระดับความมั่นใจอย่างชัดเจน",
          "กันเวลาสำรองไว้ตรงจุดที่ไม่แน่นอน ไม่ใช่เฉลี่ยเท่ากันทุกงาน",
          "ประเมินใหม่เมื่อขอบเขตงานเปลี่ยนจริง",
        ],
      },
      {
        id: "p3",
        title: "Running the Weekly",
        titleTh: "การนำประชุมประจำสัปดาห์",
        kind: "video",
        minutes: 9,
        summary: "The meeting exists to surface risk, not to read status.",
        summaryTh: "การประชุมมีไว้เพื่อเปิดเผยความเสี่ยง ไม่ใช่เพื่ออ่านสถานะ",
        bullets: [
          "Opens with risks and blockers, not with a task walkthrough.",
          "Ends with owners and dates on every open item.",
        ],
        bulletsTh: [
          "เริ่มประชุมด้วยความเสี่ยงและอุปสรรค ไม่ใช่ไล่รายการงาน",
          "ปิดประชุมโดยมีผู้รับผิดชอบและกำหนดวันของทุกเรื่องที่ค้าง",
        ],
      },
    ],
  },
  {
    id: "coaching-and-feedback",
    title: "Coaching and Feedback Conversations",
    titleTh: "การโค้ชและการสนทนาให้ฟีดแบ็ก",
    category: "Managerial",
    competencyId: "people",
    hours: 8,
    lessons: 4,
    enrolled: 27,
    status: "Published",
    cover: "from-[#00b916] to-[#006bff]",
    description:
      "The one-on-one, the difficult message, and the questions that move someone forward.",
    descriptionTh:
      "การคุยตัวต่อตัว การสื่อสารเรื่องที่พูดยาก และคำถามที่ช่วยให้คนเดินต่อได้",
    chapters: [
      {
        id: "cf1",
        title: "The Weekly One-on-One",
        titleTh: "การคุยตัวต่อตัวประจำสัปดาห์",
        kind: "video",
        minutes: 13,
        summary: "A one-on-one belongs to the person you are meeting, not to you.",
        summaryTh: "การคุยตัวต่อตัวเป็นเวลาของอีกฝ่าย ไม่ใช่ของหัวหน้า",
        bullets: [
          "Protects the slot even when the week is busy.",
          "Opens with their agenda before raising your own.",
          "Records agreements where both people can see them.",
        ],
        bulletsTh: [
          "รักษาเวลานัดไว้แม้สัปดาห์นั้นจะยุ่ง",
          "เริ่มจากหัวข้อของอีกฝ่ายก่อนจะพูดเรื่องของตนเอง",
          "บันทึกข้อตกลงไว้ในที่ที่ทั้งสองฝ่ายเห็นได้",
        ],
      },
      {
        id: "cf2",
        title: "Feedback That Lands",
        titleTh: "ฟีดแบ็กที่ไปถึงผู้รับ",
        kind: "article",
        minutes: 16,
        summary: "Feedback is a description of impact, not a verdict on a person.",
        summaryTh: "ฟีดแบ็กคือการอธิบายผลกระทบ ไม่ใช่การตัดสินตัวบุคคล",
        body:
          "Useful feedback has three parts and no fourth. Name the situation precisely enough that both of you remember the same event. Describe the behaviour you observed, in verbs, without adjectives about character. State the impact you can actually evidence — a missed handover, a customer email, a rework day. Then stop and let the other person respond; a message delivered and never discussed is a message that was not received. Deliver it close to the event, in private, and separately from any conversation about pay or promotion, otherwise the content is drowned by the stakes.",
        bodyTh:
          "ฟีดแบ็กที่ใช้ได้จริงมีสามส่วน และไม่ควรมีส่วนที่สี่ เริ่มจากระบุสถานการณ์ให้ชัดพอที่ทั้งสองฝ่ายนึกถึงเหตุการณ์เดียวกัน จากนั้นอธิบายพฤติกรรมที่สังเกตเห็นด้วยคำกริยา โดยไม่ใส่คำตัดสินนิสัย แล้วจึงบอกผลกระทบที่มีหลักฐานจริง เช่น การส่งงานที่ตกหล่น อีเมลจากลูกค้า หรือวันที่ต้องทำงานซ้ำ เมื่อพูดจบให้หยุดและเปิดให้อีกฝ่ายตอบ เพราะข้อความที่ส่งออกไปแต่ไม่เคยถูกพูดคุยต่อ คือข้อความที่ยังไม่ถึงผู้รับ ควรให้ฟีดแบ็กใกล้กับเหตุการณ์ ให้เป็นการส่วนตัว และแยกออกจากการคุยเรื่องค่าตอบแทนหรือการเลื่อนตำแหน่ง มิฉะนั้นเนื้อหาจะถูกกลบด้วยผลได้ผลเสีย",
        bullets: [
          "Separates observed behaviour from judgement of character.",
          "States the impact with evidence the other person can check.",
          "Leaves room for the other person to reply before closing.",
        ],
        bulletsTh: [
          "แยกพฤติกรรมที่สังเกตได้ออกจากการตัดสินนิสัยของคน",
          "ระบุผลกระทบพร้อมหลักฐานที่อีกฝ่ายตรวจสอบได้",
          "เปิดโอกาสให้อีกฝ่ายตอบก่อนจะปิดบทสนทนา",
        ],
      },
      {
        id: "cf3",
        title: "Coaching Question Bank",
        titleTh: "คลังคำถามสำหรับการโค้ช",
        kind: "pdf",
        pages: 18,
        minutes: 20,
        summary: "Ask before you advise — the answer they find is the one they keep.",
        summaryTh: "ถามก่อนแนะนำ คำตอบที่เขาคิดได้เองคือคำตอบที่เขาจะจำ",
        bullets: [
          "Opens with a question instead of a solution.",
          "Follows up on the answer rather than moving to the next question.",
          "Ends by asking the person to name their own next step.",
        ],
        bulletsTh: [
          "เริ่มด้วยคำถามแทนที่จะเริ่มด้วยคำตอบ",
          "ต่อยอดจากคำตอบแทนที่จะรีบข้ามไปคำถามถัดไป",
          "ปิดท้ายด้วยการให้อีกฝ่ายบอกขั้นตอนถัดไปของตนเอง",
        ],
      },
    ],
  },
  {
    id: "delegation-and-decisions",
    title: "Delegation and Decision Rights",
    titleTh: "การมอบหมายงานและสิทธิ์ในการตัดสินใจ",
    category: "Managerial",
    competencyId: "purpose",
    hours: 7,
    lessons: 4,
    enrolled: 22,
    status: "Published",
    cover: "from-[#0b1b3f] to-[#f05123]",
    description:
      "Deciding what only you can do, and writing down who decides everything else.",
    descriptionTh:
      "แยกให้ออกว่ามีอะไรที่คุณเท่านั้นทำได้ แล้วเขียนให้ชัดว่าเรื่องที่เหลือใครเป็นคนตัดสิน",
    chapters: [
      {
        id: "dd1",
        title: "What Only You Can Do",
        titleTh: "งานที่มีแต่คุณเท่านั้นที่ทำได้",
        kind: "video",
        minutes: 11,
        summary: "Most of a supervisor's calendar is work someone else should own.",
        summaryTh: "ตารางงานของหัวหน้าส่วนใหญ่คืองานที่ควรเป็นของคนอื่น",
        bullets: [
          "Lists the tasks that genuinely require the role, not the habit.",
          "Hands over the rest with context, not just instructions.",
        ],
        bulletsTh: [
          "แยกงานที่ต้องใช้ตำแหน่งจริง ๆ ออกจากงานที่ทำเพราะความเคยชิน",
          "ส่งต่องานที่เหลือพร้อมบริบท ไม่ใช่ส่งแค่คำสั่ง",
        ],
      },
      {
        id: "dd2",
        title: "The Decision Rights Matrix",
        titleTh: "ตารางสิทธิ์การตัดสินใจ",
        kind: "pdf",
        pages: 12,
        minutes: 15,
        summary: "Write down who decides, who is consulted, and who is only told.",
        summaryTh: "เขียนให้ชัดว่าใครตัดสิน ใครถูกปรึกษา และใครแค่รับทราบ",
        bullets: [
          "Names a single decision owner for every recurring decision.",
          "Distinguishes being consulted from holding a veto.",
          "Reviews the matrix when the team structure changes.",
        ],
        bulletsTh: [
          "ระบุผู้ตัดสินใจเพียงคนเดียวสำหรับการตัดสินใจที่เกิดซ้ำ",
          "แยกให้ชัดระหว่างการถูกปรึกษากับการมีสิทธิ์ยับยั้ง",
          "ทบทวนตารางใหม่เมื่อโครงสร้างทีมเปลี่ยน",
        ],
      },
      {
        id: "dd3",
        title: "Delegating the Outcome, Not the Task",
        titleTh: "มอบหมายผลลัพธ์ ไม่ใช่มอบหมายขั้นตอน",
        kind: "article",
        minutes: 12,
        summary: "If you specify every step, you have not delegated — you have queued.",
        summaryTh: "ถ้ากำหนดทุกขั้นตอนให้แล้ว นั่นไม่ใช่การมอบหมาย แต่คือการต่อคิวงาน",
        body:
          "Delegation fails in two directions. Hand over a task with every step prescribed and you keep all the thinking, all the risk, and all the interruptions; the other person learns nothing and you are still the bottleneck. Hand over an outcome with no constraints and you will be surprised late, when the cost of correcting is highest. The workable middle is an outcome, a deadline, the three constraints that are genuinely non-negotiable, and an agreed check-in before the point of no return. Say plainly which decisions are theirs. Then let the first version be theirs too.",
        bodyTh:
          "การมอบหมายงานล้มเหลวได้สองทาง ทางแรกคือส่งงานพร้อมกำหนดทุกขั้นตอน ผลคือคุณยังถือความคิด ความเสี่ยง และการถูกขัดจังหวะไว้ทั้งหมด อีกฝ่ายไม่ได้เรียนรู้อะไร และคุณยังเป็นคอขวดเหมือนเดิม ทางที่สองคือส่งผลลัพธ์ไปโดยไม่มีเงื่อนไขใด ๆ แล้วคุณจะเซอร์ไพรส์ตอนสาย ซึ่งเป็นจังหวะที่แก้ไขแพงที่สุด จุดที่ใช้ได้จริงอยู่ตรงกลาง คือระบุผลลัพธ์ กำหนดวัน ข้อจำกัดสามข้อที่ต่อรองไม่ได้จริง ๆ และนัดตรวจความคืบหน้าก่อนถึงจุดที่ย้อนกลับไม่ได้ บอกให้ชัดว่าการตัดสินใจข้อไหนเป็นของเขา แล้วปล่อยให้เวอร์ชันแรกเป็นของเขาด้วย",
        bullets: [
          "Specifies the outcome and the real constraints, not the steps.",
          "Agrees a check-in before the point of no return.",
        ],
        bulletsTh: [
          "ระบุผลลัพธ์และข้อจำกัดที่แท้จริง ไม่ใช่ระบุขั้นตอน",
          "นัดตรวจความคืบหน้าก่อนถึงจุดที่ย้อนกลับไม่ได้",
        ],
      },
    ],
  },
  {
    id: "how-to-be-funny",
    title: "How To Be Funny",
    titleTh: "ศิลปะการใช้อารมณ์ขัน",
    category: "Core",
    competencyId: "collaboration",
    hours: 6,
    lessons: 4,
    enrolled: 58,
    status: "Published",
    cover: "from-[#faa21b] to-[#f05123]",
    description: "Humour as a team tool: timing, warmth, and knowing when not to.",
    descriptionTh:
      "อารมณ์ขันในฐานะเครื่องมือของทีม ทั้งจังหวะ ความอบอุ่น และการรู้ว่าเมื่อไรไม่ควรใช้",
    chapters: [
      {
        id: "f1",
        title: "Timing Is Everything",
        titleTh: "จังหวะคือทุกอย่าง",
        kind: "video",
        minutes: 8,
        summary: "The joke lands in the pause, not in the punchline.",
        summaryTh: "มุกตลกทำงานตรงจังหวะเงียบ ไม่ใช่ตรงประโยคปิด",
        bullets: [
          "Leaves room for the other person to react.",
          "Reads whether the moment can hold levity at all.",
        ],
        bulletsTh: [
          "เว้นที่ว่างให้อีกฝ่ายได้ตอบสนอง",
          "ประเมินว่าสถานการณ์นั้นรับอารมณ์ขันได้หรือไม่",
        ],
      },
      {
        id: "f2",
        title: "Punch Up, Never Down",
        titleTh: "ล้อขึ้น ไม่ล้อลง",
        kind: "article",
        minutes: 10,
        summary: "Humour that costs someone else is not free.",
        summaryTh: "อารมณ์ขันที่ทำให้คนอื่นเสียหาย ไม่ใช่เรื่องฟรี",
        body:
          "The cheapest laugh in any room is at the expense of the person with the least power in it, and it is the only kind that leaves a bill. Aim at the situation, at the process, at yourself. Before you use a running joke about a colleague, check that they are in the room, that they started it, and that they can end it. If any of those three is false, it is not a shared joke — it is a rank display with a laugh attached.",
        bodyTh:
          "เสียงหัวเราะที่ได้มาง่ายที่สุดในห้องประชุม มักได้มาจากการล้อคนที่มีอำนาจน้อยที่สุดในห้อง และเป็นเสียงหัวเราะแบบเดียวที่ทิ้งใบเรียกเก็บเงินไว้ ให้เล็งไปที่สถานการณ์ ที่กระบวนการ หรือที่ตัวเอง ก่อนจะหยิบมุกประจำที่ล้อเพื่อนร่วมงานขึ้นมาใช้ ลองตรวจสามข้อ คือเขาอยู่ในห้องด้วยหรือไม่ เขาเป็นคนเริ่มมุกนี้เองหรือไม่ และเขาหยุดมุกนี้ได้หรือไม่ ถ้าข้อใดข้อหนึ่งไม่จริง นั่นไม่ใช่มุกร่วมกัน แต่คือการแสดงลำดับอำนาจที่มีเสียงหัวเราะแนบมาด้วย",
        bullets: [
          "Targets situations and self, not colleagues.",
          "Checks whether everyone in the room is in on it.",
        ],
        bulletsTh: [
          "เล็งไปที่สถานการณ์และตัวเอง ไม่ใช่เพื่อนร่วมงาน",
          "ตรวจสอบว่าทุกคนในห้องเข้าใจและร่วมสนุกด้วยจริง",
        ],
      },
    ],
  },
  {
    id: "advanced-aws",
    title: "Advanced AWS",
    titleTh: "AWS ขั้นสูง",
    category: "Functional",
    competencyId: "architecture",
    hours: 18,
    lessons: 8,
    enrolled: 24,
    status: "Published",
    cover: "from-[#0b1b3f] to-[#006bff]",
    description: "Networking, IAM boundaries, and cost-aware architecture on AWS.",
    descriptionTh:
      "ระบบเครือข่าย ขอบเขตสิทธิ์ IAM และการออกแบบสถาปัตยกรรมโดยคำนึงถึงต้นทุนบน AWS",
    chapters: [
      {
        id: "a1",
        title: "VPC and Network Boundaries",
        titleTh: "VPC และขอบเขตของเครือข่าย",
        kind: "video",
        minutes: 22,
        summary: "Design the blast radius before you design the service.",
        summaryTh: "ออกแบบวงความเสียหายก่อนออกแบบตัวเซอร์วิส",
        bullets: [
          "Segments workloads by trust level, not by convenience.",
          "Keeps egress paths explicit and auditable.",
        ],
        bulletsTh: [
          "แบ่งส่วนงานตามระดับความน่าเชื่อถือ ไม่ใช่ตามความสะดวก",
          "กำหนดเส้นทางขาออกให้ชัดเจนและตรวจสอบย้อนหลังได้",
        ],
      },
      {
        id: "a2",
        title: "IAM That Scales",
        titleTh: "IAM ที่ขยายตัวได้",
        kind: "pdf",
        pages: 22,
        minutes: 19,
        summary: "Least privilege is a process, not a policy document.",
        summaryTh: "สิทธิ์ขั้นต่ำที่จำเป็นคือกระบวนการ ไม่ใช่เอกสารนโยบาย",
        bullets: [
          "Uses roles over long-lived keys everywhere.",
          "Reviews permission drift on a schedule.",
        ],
        bulletsTh: [
          "ใช้ role แทนคีย์ถาวรในทุกกรณี",
          "ทบทวนสิทธิ์ที่เพี้ยนไปจากเดิมตามรอบเวลาที่กำหนด",
        ],
      },
    ],
  },
  {
    id: "design-system",
    title: "Design System",
    titleTh: "ดีไซน์ซิสเต็ม",
    category: "Functional",
    competencyId: "architecture",
    hours: 10,
    lessons: 5,
    enrolled: 19,
    status: "Published",
    cover: "from-[#006bff] to-[#00b916]",
    description: "Tokens, components, and the governance that keeps them honest.",
    descriptionTh: "โทเคน คอมโพเนนต์ และกลไกกำกับดูแลที่ทำให้ทั้งสองอย่างยังตรงกัน",
    chapters: [
      {
        id: "d1",
        title: "Tokens First",
        titleTh: "เริ่มจากโทเคนก่อน",
        kind: "article",
        minutes: 13,
        summary: "Every hard-coded hex is a future migration.",
        summaryTh: "ทุกค่าสีที่ฝังตายตัวคือการย้ายระบบในอนาคต",
        body:
          "A design token is a name for a decision. `brand` is a decision; `#006BFF` is only its current value. Name tokens by the role they play — surface, line, accent, danger — because roles survive a rebrand and appearances do not. Keep exactly one source of truth and generate both the CSS variables and the design-tool styles from it; the moment the two are maintained by hand, they diverge within a release. Governance is the boring half: a token is added by request with a stated use case, and removed only after the last usage is gone.",
        bodyTh:
          "โทเคนคือชื่อของการตัดสินใจ คำว่า brand คือการตัดสินใจ ส่วน #006BFF เป็นเพียงค่าปัจจุบันของมัน ควรตั้งชื่อโทเคนตามบทบาทที่มันทำ เช่น surface, line, accent, danger เพราะบทบาทอยู่รอดหลังการรีแบรนด์ ในขณะที่หน้าตาไม่อยู่รอด เก็บแหล่งข้อมูลจริงไว้เพียงแหล่งเดียว แล้วสร้างทั้งตัวแปร CSS และสไตล์ในเครื่องมือออกแบบจากแหล่งนั้น เพราะทันทีที่ต้องดูแลสองที่ด้วยมือ ทั้งสองจะเริ่มไม่ตรงกันภายในรอบปล่อยเดียว ส่วนงานกำกับดูแลคือครึ่งที่น่าเบื่อ โทเคนจะถูกเพิ่มเมื่อมีคำขอพร้อมกรณีใช้งานที่ชัดเจน และจะถูกลบก็ต่อเมื่อไม่มีที่ไหนเรียกใช้แล้ว",
        bullets: [
          "Names tokens by role, never by appearance.",
          "Keeps one source of truth between design and code.",
        ],
        bulletsTh: [
          "ตั้งชื่อโทเคนตามบทบาท ไม่ใช่ตามหน้าตา",
          "รักษาแหล่งข้อมูลจริงเพียงแหล่งเดียวระหว่างงานออกแบบกับโค้ด",
        ],
      },
    ],
  },
  {
    id: "clean-code-and-reviews",
    title: "Clean Code and Code Review",
    titleTh: "โค้ดที่สะอาดและการรีวิวโค้ด",
    category: "Functional",
    competencyId: "version-control",
    hours: 9,
    lessons: 5,
    enrolled: 35,
    status: "Published",
    cover: "from-[#006bff] to-[#0061c8]",
    description:
      "Naming, small diffs, and reviews that catch risk instead of style opinions.",
    descriptionTh:
      "การตั้งชื่อ การส่ง diff เล็ก ๆ และการรีวิวที่จับความเสี่ยงแทนการเถียงเรื่องสไตล์",
    chapters: [
      {
        id: "cc1",
        title: "Naming Is the Whole Job",
        titleTh: "การตั้งชื่อคืองานเกือบทั้งหมด",
        kind: "article",
        minutes: 12,
        summary: "A good name removes the comment you were about to write.",
        summaryTh: "ชื่อที่ดีทำให้คอมเมนต์ที่กำลังจะเขียนไม่จำเป็นอีกต่อไป",
        body:
          "Reach for a name that states the intent, not the mechanism: `pendingApprovals` rather than `list2`, `expectedLevel` rather than `n`. When a name needs a qualifier to be honest — `usersButOnlyActive` — the code is telling you that one function is doing two jobs. Booleans read best as questions the reader can answer yes or no. And when you cannot name a thing at all, that is usually not a naming problem; it is a sign the abstraction has not been found yet.",
        bodyTh:
          "เลือกชื่อที่บอกเจตนา ไม่ใช่บอกกลไก เช่นใช้ pendingApprovals แทน list2 หรือ expectedLevel แทน n เมื่อใดที่ชื่อต้องมีคำขยายต่อท้ายเพื่อให้ตรงความจริง เช่น usersButOnlyActive นั่นคือสัญญาณว่าฟังก์ชันเดียวกำลังทำงานสองอย่าง ตัวแปรบูลีนอ่านง่ายที่สุดเมื่อเขียนเป็นคำถามที่ตอบใช่หรือไม่ได้ และถ้าตั้งชื่อสิ่งนั้นไม่ได้เลย มักไม่ใช่ปัญหาเรื่องชื่อ แต่เป็นสัญญาณว่ายังหาแนวคิดที่ถูกต้องไม่เจอ",
        bullets: [
          "Writes clean, readable code following industry best practices.",
          "Names things for intent instead of for mechanism.",
        ],
        bulletsTh: [
          "เขียนโค้ดที่สะอาดและอ่านง่ายตามแนวปฏิบัติที่ดีของอุตสาหกรรม",
          "ตั้งชื่อตามเจตนาแทนที่จะตั้งตามกลไก",
        ],
      },
      {
        id: "cc2",
        title: "Reviewing for Risk",
        titleTh: "รีวิวโดยมองที่ความเสี่ยง",
        kind: "video",
        minutes: 14,
        summary: "A review is a risk conversation, not a style audit.",
        summaryTh: "การรีวิวคือการคุยเรื่องความเสี่ยง ไม่ใช่การตรวจสไตล์",
        bullets: [
          "Reads the tests before reading the implementation.",
          "Separates blocking concerns from personal preference.",
          "Resolves merge conflicts efficiently and reviews thoroughly.",
        ],
        bulletsTh: [
          "อ่านเทสต์ก่อนอ่านโค้ดที่เขียนจริง",
          "แยกประเด็นที่ต้องแก้ก่อนรวมโค้ด ออกจากความชอบส่วนตัว",
          "แก้ conflict ได้อย่างมีประสิทธิภาพและรีวิวอย่างละเอียด",
        ],
      },
      {
        id: "cc3",
        title: "Branching Playbook",
        titleTh: "คู่มือการแตกสาขาโค้ด",
        kind: "pdf",
        pages: 9,
        minutes: 10,
        summary: "Short-lived branches are the cheapest merge strategy there is.",
        summaryTh: "สาขาที่อายุสั้นคือกลยุทธ์การรวมโค้ดที่ถูกที่สุด",
        bullets: [
          "Follows standardized branching and merging strategies.",
          "Writes clear, descriptive commit messages for traceability.",
        ],
        bulletsTh: [
          "ทำตามแนวทางการแตกสาขาและรวมโค้ดที่เป็นมาตรฐานเดียวกัน",
          "เขียนข้อความคอมมิตที่ชัดเจนเพื่อให้ตามรอยย้อนหลังได้",
        ],
      },
    ],
  },
  {
    id: "data-modelling-essentials",
    title: "Data Modelling Essentials",
    titleTh: "พื้นฐานการออกแบบโครงสร้างข้อมูล",
    category: "Functional",
    competencyId: "databases",
    hours: 11,
    lessons: 6,
    enrolled: 21,
    status: "Published",
    cover: "from-[#697077] to-[#006bff]",
    description: "Entities, indexes, and migrations you can run during business hours.",
    descriptionTh:
      "เอนทิตี ดัชนี และการย้ายโครงสร้างข้อมูลที่รันได้ในเวลาทำการ",
    chapters: [
      {
        id: "dm1",
        title: "Entities Before Tables",
        titleTh: "เอนทิตีมาก่อนตาราง",
        kind: "video",
        minutes: 15,
        summary: "Model the business fact first; the table is an implementation detail.",
        summaryTh: "ออกแบบข้อเท็จจริงทางธุรกิจก่อน ส่วนตารางเป็นเพียงรายละเอียดการทำงาน",
        bullets: [
          "Designs efficient database schemas and maintains data integrity.",
          "Names entities after the business fact, not the screen.",
        ],
        bulletsTh: [
          "ออกแบบสคีมาที่มีประสิทธิภาพและรักษาความถูกต้องของข้อมูล",
          "ตั้งชื่อเอนทิตีตามข้อเท็จจริงทางธุรกิจ ไม่ใช่ตามหน้าจอ",
        ],
      },
      {
        id: "dm2",
        title: "Indexing Cheat Sheet",
        titleTh: "สรุปย่อเรื่องการทำดัชนี",
        kind: "pdf",
        pages: 16,
        minutes: 18,
        summary: "An index you cannot justify is a write you are paying for twice.",
        summaryTh: "ดัชนีที่อธิบายเหตุผลไม่ได้ คือการเขียนข้อมูลที่จ่ายซ้ำสองรอบ",
        bullets: [
          "Writes and optimizes complex queries for performance.",
          "Measures with the query plan before adding an index.",
        ],
        bulletsTh: [
          "เขียนและปรับแต่งคิวรีที่ซับซ้อนให้ทำงานได้เร็วขึ้น",
          "ตรวจแผนการทำงานของคิวรีก่อนจะเพิ่มดัชนี",
        ],
      },
      {
        id: "dm3",
        title: "Migrations Without Downtime",
        titleTh: "ย้ายโครงสร้างข้อมูลโดยไม่ต้องปิดระบบ",
        kind: "article",
        minutes: 14,
        summary: "Expand, backfill, contract — in three deploys, never one.",
        summaryTh: "ขยาย เติมข้อมูล แล้วค่อยตัดทิ้ง ทำสามรอบดีพลอย ไม่ใช่รอบเดียว",
        body:
          "A schema change that ships in one deploy assumes the old and new code never run at the same time, which is false the moment you have more than one instance. Expand first: add the new column, nullable, and write to both. Backfill in batches you can pause, with a progress marker you can read. Only when reads have moved and the metric has been flat for a release do you contract and drop the old column. Each of the three steps is independently reversible, which is the entire point.",
        bodyTh:
          "การเปลี่ยนสคีมาในดีพลอยเดียวตั้งอยู่บนสมมติฐานว่าโค้ดเก่ากับโค้ดใหม่จะไม่ทำงานพร้อมกัน ซึ่งไม่จริงทันทีที่มีอินสแตนซ์มากกว่าหนึ่งตัว ให้เริ่มจากการขยายก่อน คือเพิ่มคอลัมน์ใหม่แบบยอมให้ว่างได้ แล้วเขียนข้อมูลลงทั้งสองที่ จากนั้นเติมข้อมูลย้อนหลังเป็นชุด ๆ ที่หยุดกลางคันได้ และมีตัวบอกความคืบหน้าที่อ่านได้ เมื่อฝั่งอ่านย้ายไปใช้คอลัมน์ใหม่แล้วและตัวชี้วัดนิ่งครบหนึ่งรอบปล่อย จึงค่อยตัดคอลัมน์เดิมทิ้ง ทั้งสามขั้นตอนย้อนกลับได้อย่างอิสระ ซึ่งคือหัวใจของวิธีนี้",
        bullets: [
          "Understands data caching strategies and migration processes.",
          "Ships schema changes as reversible steps, not one big cut-over.",
        ],
        bulletsTh: [
          "เข้าใจกลยุทธ์การแคชข้อมูลและกระบวนการย้ายโครงสร้าง",
          "ปล่อยการเปลี่ยนสคีมาเป็นขั้นตอนที่ย้อนกลับได้ ไม่ใช่สลับทีเดียวจบ",
        ],
      },
    ],
  },
  {
    id: "nodejs-expert",
    title: "Node.js Expert",
    titleTh: "Node.js ระดับผู้เชี่ยวชาญ",
    category: "Functional",
    competencyId: "programming",
    hours: 12,
    lessons: 6,
    enrolled: 27,
    status: "Published",
    cover: "from-[#00b916] to-[#0b1b3f]",
    description: "Event loop, streams, and production-grade error handling.",
    descriptionTh: "อีเวนต์ลูป สตรีม และการจัดการข้อผิดพลาดระดับใช้งานจริง",
    chapters: [
      {
        id: "n1",
        title: "The Event Loop, Honestly",
        titleTh: "อีเวนต์ลูปแบบตรงไปตรงมา",
        kind: "video",
        minutes: 16,
        summary: "Blocking is a design decision you did not know you made.",
        summaryTh: "การบล็อกคือการตัดสินใจออกแบบที่คุณไม่รู้ตัวว่าได้ตัดสินใจไปแล้ว",
        bullets: [
          "Identifies CPU-bound work hiding in request handlers.",
          "Moves heavy work off the loop deliberately.",
        ],
        bulletsTh: [
          "ตรวจหางานที่กินซีพียูซึ่งซ่อนอยู่ในตัวจัดการรีเควสต์",
          "ย้ายงานหนักออกจากอีเวนต์ลูปอย่างตั้งใจ",
        ],
      },
      {
        id: "n2",
        title: "Errors You Can Operate",
        titleTh: "ข้อผิดพลาดที่ดูแลระบบต่อได้",
        kind: "pdf",
        pages: 11,
        minutes: 13,
        summary: "An error without context is a ticket someone else has to reproduce.",
        summaryTh: "ข้อผิดพลาดที่ไม่มีบริบท คือทิกเก็ตที่คนอื่นต้องมานั่งทำซ้ำเอง",
        bullets: [
          "Attaches the operation and the identifiers to every thrown error.",
          "Distinguishes expected failures from real defects in the logs.",
        ],
        bulletsTh: [
          "แนบชื่อการทำงานและตัวระบุข้อมูลไปกับข้อผิดพลาดทุกครั้ง",
          "แยกความล้มเหลวที่คาดไว้ออกจากข้อบกพร่องจริงในล็อก",
        ],
      },
    ],
  },
  {
    id: "network-security",
    title: "Network Security",
    titleTh: "ความมั่นคงปลอดภัยของเครือข่าย",
    category: "Functional",
    competencyId: "databases",
    hours: 13,
    lessons: 7,
    enrolled: 16,
    status: "Draft",
    cover: "from-[#1c1e29] to-[#006bff]",
    description: "Threat modelling and defence in depth for product engineers.",
    descriptionTh:
      "การวิเคราะห์ภัยคุกคามและการป้องกันหลายชั้นสำหรับวิศวกรสายผลิตภัณฑ์",
    chapters: [
      {
        id: "s1",
        title: "Threat Modelling in an Hour",
        titleTh: "วิเคราะห์ภัยคุกคามภายในหนึ่งชั่วโมง",
        kind: "pdf",
        pages: 31,
        minutes: 20,
        summary: "You cannot defend a system you cannot draw.",
        summaryTh: "คุณป้องกันระบบที่วาดออกมาไม่ได้ไม่ได้",
        bullets: [
          "Maps trust boundaries before listing threats.",
          "Ranks by exploitability, not by scariness.",
        ],
        bulletsTh: [
          "วาดขอบเขตความน่าเชื่อถือก่อนจะไล่รายการภัยคุกคาม",
          "จัดลำดับตามความเป็นไปได้ที่จะถูกโจมตี ไม่ใช่ตามความน่ากลัว",
        ],
      },
    ],
  },

  /* --------------------------------------------------- Core: Create Impact */
  {
    id: "impact-prioritisation",
    title: "Choosing Work That Moves the Needle",
    titleTh: "เลือกงานที่สร้างผลลัพธ์จริง",
    category: "Core",
    competencyId: "create-impact",
    hours: 7,
    lessons: 4,
    enrolled: 46,
    status: "Published",
    cover: "from-[#006bff] to-[#00b916]",
    description:
      "Level 2 finishes what it is given. Level 3 chooses what to finish — and can say why that work mattered.",
    descriptionTh:
      "ระดับ 2 ทำงานที่ได้รับมอบหมายให้เสร็จ ระดับ 3 เลือกได้ว่าจะทำอะไรก่อน และอธิบายได้ว่าทำไมงานนั้นสำคัญ",
    chapters: [
      {
        id: "ip1",
        title: "The Value Question",
        titleTh: "คำถามเรื่องคุณค่าของงาน",
        kind: "video",
        minutes: 14,
        summary: "Before you start a task, be able to finish the sentence “this matters because…”.",
        summaryTh: "ก่อนเริ่มงาน ต้องต่อประโยคนี้ให้จบได้ว่า “งานนี้สำคัญเพราะ…”",
        bullets: [
          "Identifies and prioritizes tasks that deliver the most significant value to the product or user.",
          "Traces each task back to a team or company goal before starting it.",
          "Asks who is worse off if the task is not done at all.",
        ],
        bulletsTh: [
          "ระบุและจัดลำดับงานที่สร้างคุณค่าสูงสุดต่อผลิตภัณฑ์หรือผู้ใช้",
          "โยงงานแต่ละชิ้นกลับไปหาเป้าหมายของทีมหรือองค์กรก่อนลงมือทำ",
          "ตั้งคำถามว่าถ้าไม่ทำงานชิ้นนี้เลย ใครจะได้รับผลกระทบ",
        ],
      },
      {
        id: "ip2",
        title: "Impact and Effort in Practice",
        titleTh: "ผลลัพธ์กับแรงที่ลงไปในทางปฏิบัติ",
        kind: "pdf",
        pages: 14,
        minutes: 16,
        summary: "A ranked list beats a two-by-two grid you never look at again.",
        summaryTh: "รายการที่จัดลำดับไว้จริง ใช้ได้ดีกว่าตารางสี่ช่องที่ไม่เคยกลับมาดูอีกเลย",
        bullets: [
          "Scores work on reach and reversibility, not only on how long it takes.",
          "Re-ranks the list weekly instead of ranking it once per quarter.",
          "Keeps a visible “not doing” list so trade-offs stay explicit.",
        ],
        bulletsTh: [
          "ให้คะแนนงานจากขอบเขตที่กระทบและความย้อนกลับได้ ไม่ใช่ดูแค่ว่าใช้เวลานานแค่ไหน",
          "จัดลำดับใหม่ทุกสัปดาห์ แทนที่จะจัดครั้งเดียวต่อไตรมาส",
          "เก็บรายการ “งานที่เลือกไม่ทำ” ไว้ให้เห็น เพื่อให้การแลกเปลี่ยนชัดเจน",
        ],
      },
      {
        id: "ip3",
        title: "Saying No to Work Without Impact",
        titleTh: "ปฏิเสธงานที่ไม่สร้างผลลัพธ์",
        kind: "article",
        minutes: 12,
        summary: "Declining well is a contribution, not an obstruction.",
        summaryTh: "การปฏิเสธอย่างมีเหตุผลคือการมีส่วนร่วม ไม่ใช่การขัดขวาง",
        body:
          "The behaviour that separates level 2 from level 3 here is not working harder — it is redirecting effort. Two days spent on a slide deck nobody needed is two days taken from the work that would have shown up in a metric. When a request arrives, do not answer yes or no; answer with the trade. Name what you would have to stop or delay, state the outcome each option produces, and let the requester choose with that information. If you cannot describe the outcome of the new request in one measurable sentence, that is itself the finding, and it belongs in the reply. Declining with a written trade-off is auditable; declining with \"I'm busy\" is not.",
        bodyTh:
          "สิ่งที่แยกระดับ 2 ออกจากระดับ 3 ในสมรรถนะนี้ ไม่ใช่การทำงานหนักขึ้น แต่คือการเปลี่ยนทิศทางของแรงที่ลงไป การใช้เวลาสองวันทำสไลด์ที่ไม่มีใครต้องการ คือสองวันที่ถูกดึงออกจากงานที่จะปรากฏในตัวชี้วัดจริง เมื่อมีคำขอเข้ามา อย่าเพิ่งตอบว่ารับหรือไม่รับ แต่ให้ตอบด้วยสิ่งที่ต้องแลก ระบุว่าคุณจะต้องหยุดหรือเลื่อนงานใด บอกผลลัพธ์ของแต่ละทางเลือก แล้วให้ผู้ขอเป็นคนเลือกบนข้อมูลนั้น หากคุณอธิบายผลลัพธ์ของคำขอใหม่เป็นประโยคที่วัดได้ไม่ได้เลย นั่นเองคือข้อค้นพบที่ควรบอกกลับไป การปฏิเสธพร้อมสิ่งที่ต้องแลกเป็นเรื่องที่ตรวจสอบย้อนหลังได้ ส่วนการปฏิเสธด้วยคำว่า “ยุ่งอยู่” นั้นตรวจสอบไม่ได้",
        bullets: [
          "Replies to a new request with the trade-off, not with a flat refusal.",
          "Proactively proposes solutions that improve efficiency or reduce cost.",
        ],
        bulletsTh: [
          "ตอบคำขอใหม่ด้วยสิ่งที่ต้องแลก ไม่ใช่การปฏิเสธลอย ๆ",
          "เสนอแนวทางที่ช่วยเพิ่มประสิทธิภาพหรือลดต้นทุนอย่างเป็นเชิงรุก",
        ],
      },
    ],
  },
  {
    id: "measuring-your-work",
    title: "Measuring the Work You Deliver",
    titleTh: "วัดผลงานที่คุณส่งมอบ",
    category: "Core",
    competencyId: "create-impact",
    hours: 6,
    lessons: 4,
    enrolled: 38,
    status: "Published",
    cover: "from-[#faa21b] to-[#00b916]",
    description:
      "Collecting the number before you change anything, so the result is something you can show rather than claim.",
    descriptionTh:
      "เก็บตัวเลขไว้ก่อนจะลงมือเปลี่ยนอะไร เพื่อให้ผลลัพธ์เป็นสิ่งที่แสดงให้เห็นได้ ไม่ใช่แค่กล่าวอ้าง",
    chapters: [
      {
        id: "mw1",
        title: "Every Task Has a Number",
        titleTh: "ทุกงานมีตัวเลขของมัน",
        kind: "article",
        minutes: 13,
        summary: "If you cannot name the measure, you cannot report the impact.",
        summaryTh: "ถ้าบอกไม่ได้ว่าจะวัดด้วยอะไร ก็รายงานผลลัพธ์ไม่ได้",
        body:
          "The level 2 pattern is a project that closes with a sentence like \"it went well\". The level 3 pattern is the same project closing with a number and the date it was taken. Almost any task has one: minutes per run, tickets reopened, steps in a handover, people who had to be asked. Pick the measure at the start, not at the end — a measure chosen after the fact tends to be the one that flatters the result. Write down the value before your change, the value after, and how you collected both. Two lines of arithmetic that a colleague could repeat is worth more than a paragraph of adjectives.",
        bodyTh:
          "รูปแบบของระดับ 2 คือโครงการที่ปิดจบด้วยประโยคว่า “ไปได้ด้วยดี” ส่วนรูปแบบของระดับ 3 คือโครงการเดียวกันที่ปิดจบด้วยตัวเลขและวันที่เก็บตัวเลขนั้น งานเกือบทุกชิ้นมีตัวเลขของมัน เช่น นาทีต่อรอบการทำงาน จำนวนงานที่ถูกเปิดซ้ำ จำนวนขั้นตอนในการส่งต่องาน หรือจำนวนคนที่ต้องถามก่อนงานจะเดินต่อได้ ให้เลือกตัวชี้วัดตั้งแต่ต้น ไม่ใช่ตอนจบ เพราะตัวชี้วัดที่เลือกภายหลังมักเป็นตัวที่ทำให้ผลดูดี บันทึกค่าก่อนเปลี่ยน ค่าหลังเปลี่ยน และวิธีเก็บทั้งสองค่า การคำนวณสองบรรทัดที่เพื่อนร่วมงานทำซ้ำได้ มีค่ามากกว่าคำบรรยายยาวหนึ่งย่อหน้า",
        bullets: [
          "Measures and evaluates the outcomes of their work to ensure a positive business impact.",
          "Chooses the measure before the work starts, not after it finishes.",
        ],
        bulletsTh: [
          "วัดและประเมินผลลัพธ์ของงานตนเองเพื่อให้มั่นใจว่าเกิดผลดีต่อธุรกิจ",
          "เลือกตัวชี้วัดก่อนเริ่มงาน ไม่ใช่หลังงานจบแล้ว",
        ],
      },
      {
        id: "mw2",
        title: "Baselines and Before/After",
        titleTh: "ค่าตั้งต้นและการเทียบก่อนหลัง",
        kind: "video",
        minutes: 15,
        summary: "A result without a baseline is an opinion with a number attached.",
        summaryTh: "ผลลัพธ์ที่ไม่มีค่าตั้งต้น คือความเห็นที่มีตัวเลขติดมาด้วยเท่านั้น",
        bullets: [
          "Records the starting value before making any change.",
          "Keeps the collection method identical on both sides of the change.",
          "Reports the range of the measurement, not just the best run.",
        ],
        bulletsTh: [
          "บันทึกค่าตั้งต้นก่อนจะเริ่มเปลี่ยนแปลงอะไร",
          "ใช้วิธีเก็บข้อมูลแบบเดียวกันทั้งก่อนและหลังการเปลี่ยนแปลง",
          "รายงานช่วงของค่าที่วัดได้ ไม่ใช่รายงานเฉพาะรอบที่ดีที่สุด",
        ],
      },
      {
        id: "mw3",
        title: "The One-Page Impact Report",
        titleTh: "รายงานผลลัพธ์หนึ่งหน้า",
        kind: "pdf",
        pages: 10,
        minutes: 12,
        summary: "Report on every project, not only the ones that went well.",
        summaryTh: "สรุปผลทุกโครงการ ไม่ใช่เฉพาะโครงการที่ผลออกมาดี",
        bullets: [
          "Writes a short close-out note for every project so the data is continuous.",
          "States what did not improve alongside what did.",
          "Shares the method so another team can reuse it.",
        ],
        bulletsTh: [
          "เขียนบันทึกปิดงานสั้น ๆ ทุกโครงการ เพื่อให้มีข้อมูลต่อเนื่องไว้เปรียบเทียบ",
          "ระบุสิ่งที่ยังไม่ดีขึ้นควบคู่กับสิ่งที่ดีขึ้น",
          "แบ่งปันวิธีการเพื่อให้ทีมอื่นนำไปใช้ต่อได้",
        ],
      },
    ],
  },

  /* -------------------------------------------------- Core: Take Ownership */
  {
    id: "end-to-end-ownership",
    title: "Owning Work End to End",
    titleTh: "รับผิดชอบงานตั้งแต่ต้นจนจบ",
    category: "Core",
    competencyId: "take-ownership",
    hours: 8,
    lessons: 5,
    enrolled: 51,
    status: "Published",
    cover: "from-[#f05123] to-[#0b1b3f]",
    description:
      "Delivering on time without being chased: the handover points where ownership is usually dropped, and how to hold them.",
    descriptionTh:
      "ส่งงานตรงเวลาโดยไม่ต้องมีคนตาม เรียนรู้จุดส่งต่องานที่ความรับผิดชอบมักหลุดมือ และวิธีรักษาไว้",
    chapters: [
      {
        id: "eo1",
        title: "Where Handovers Break",
        titleTh: "จุดที่การส่งต่องานมักพัง",
        kind: "video",
        minutes: 13,
        summary: "Work is rarely dropped in the middle; it is dropped at the edges.",
        summaryTh: "งานไม่ค่อยหลุดตอนกลาง แต่มักหลุดตรงรอยต่อ",
        bullets: [
          "Takes accountability for both successes and failures without making excuses.",
          "Confirms the receiving side has actually accepted the handover.",
          "Follows the task past their own step until it is genuinely finished.",
        ],
        bulletsTh: [
          "รับผิดชอบทั้งผลสำเร็จและความผิดพลาดโดยไม่หาข้ออ้าง",
          "ยืนยันว่าฝ่ายที่รับงานต่อได้รับงานจริงแล้ว",
          "ติดตามงานต่อเลยขั้นตอนของตนเอง จนกว่างานจะเสร็จจริง",
        ],
      },
      {
        id: "eo2",
        title: "Raise It Early, Raise It With a Plan",
        titleTh: "แจ้งแต่เนิ่น ๆ และแจ้งพร้อมแผน",
        kind: "article",
        minutes: 14,
        summary: "Escalating a risk is ownership; escalating a finished failure is reporting.",
        summaryTh: "การแจ้งความเสี่ยงคือความรับผิดชอบ ส่วนการแจ้งความล้มเหลวที่เกิดไปแล้วคือการรายงาน",
        body:
          "The level 2 habit is to wait — to hope the delay closes itself, and to tell the manager on the day the deadline is missed. The level 3 habit is to raise the risk the moment it is credible, and to raise it in a shape the other person can act on: what is at risk, by how much, what you have already tried, and the two options you see with the cost of each. That last part is what separates escalation from complaint. Notice also what you should not do: escalating everything is its own failure, because it hands your judgement back to your manager. Raise what threatens the commitment; handle the rest.",
        bodyTh:
          "นิสัยแบบระดับ 2 คือรอ หวังว่าความล่าช้าจะคลี่คลายไปเอง แล้วค่อยบอกหัวหน้าในวันที่เลยกำหนดส่งไปแล้ว ส่วนนิสัยแบบระดับ 3 คือแจ้งความเสี่ยงทันทีที่มีเหตุให้เชื่อได้ และแจ้งในรูปแบบที่อีกฝ่ายลงมือต่อได้ คือบอกว่าอะไรกำลังเสี่ยง เสี่ยงมากแค่ไหน ลองทำอะไรไปแล้วบ้าง และมีทางเลือกสองทางอะไรพร้อมต้นทุนของแต่ละทาง ส่วนสุดท้ายนี้เองที่แยกการแจ้งเตือนออกจากการบ่น อีกด้านหนึ่งที่ต้องระวังคือการแจ้งทุกเรื่องขึ้นไปก็เป็นความล้มเหลวเช่นกัน เพราะเท่ากับโยนการตัดสินใจกลับไปให้หัวหน้าทั้งหมด ให้แจ้งเฉพาะเรื่องที่กระทบคำมั่นที่ให้ไว้ ส่วนที่เหลือจัดการเอง",
        bullets: [
          "Reports a problem to the manager and stakeholders as soon as it is found.",
          "Brings options with costs, not only the bad news.",
          "Proactively identifies potential blockers and resolves them independently.",
        ],
        bulletsTh: [
          "รายงานปัญหาต่อหัวหน้าและผู้เกี่ยวข้องทันทีที่พบ",
          "เสนอทางเลือกพร้อมต้นทุน ไม่ใช่แจ้งแต่ข่าวร้าย",
          "มองเห็นอุปสรรคล่วงหน้าและลงมือแก้ไขด้วยตนเอง",
        ],
      },
      {
        id: "eo3",
        title: "Commitment Checklist",
        titleTh: "เช็กลิสต์คำมั่นในการส่งงาน",
        kind: "pdf",
        pages: 12,
        minutes: 11,
        summary: "A date you agreed to is a promise with a definition of done attached.",
        summaryTh: "วันที่คุณตกลงไว้ คือคำสัญญาที่มีนิยามของคำว่าเสร็จแนบมาด้วย",
        bullets: [
          "Follows through on commitments and completes work to a high standard.",
          "Agrees the definition of done at the same time as the date.",
          "Reviews open commitments once a week rather than once a quarter.",
        ],
        bulletsTh: [
          "ทำตามคำมั่นที่ให้ไว้และส่งมอบงานตามมาตรฐานที่สูง",
          "ตกลงนิยามของคำว่า “เสร็จ” พร้อมกันกับการตกลงวันส่ง",
          "ทบทวนคำมั่นที่ยังค้างอยู่สัปดาห์ละครั้ง ไม่ใช่ไตรมาสละครั้ง",
        ],
      },
    ],
  },
  {
    id: "blameless-problem-solving",
    title: "Blameless Problem Solving",
    titleTh: "แก้ปัญหาโดยไม่โทษกัน",
    category: "Core",
    competencyId: "take-ownership",
    hours: 5,
    lessons: 3,
    enrolled: 33,
    status: "Published",
    cover: "from-[#697077] to-[#f05123]",
    description:
      "When something breaks, the useful question is what the process allowed — not who touched it last.",
    descriptionTh:
      "เมื่อมีอะไรผิดพลาด คำถามที่มีประโยชน์คือกระบวนการเปิดช่องให้เกิดขึ้นได้อย่างไร ไม่ใช่ใครเป็นคนแตะล่าสุด",
    chapters: [
      {
        id: "bp1",
        title: "The Five Whys, Honestly",
        titleTh: "ถามว่าทำไมห้าครั้งอย่างตรงไปตรงมา",
        kind: "video",
        minutes: 12,
        summary: "Stop asking why when the answer stops being a person.",
        summaryTh: "หยุดถามว่าทำไม เมื่อคำตอบไม่ใช่ตัวบุคคลอีกต่อไป",
        bullets: [
          "Traces a failure to the process that allowed it, not to the person who hit it.",
          "Keeps asking until the answer is something the team can change.",
        ],
        bulletsTh: [
          "สาวความผิดพลาดไปหากระบวนการที่เปิดช่องให้เกิด ไม่ใช่ไปหาคนที่ไปเจอเข้า",
          "ถามต่อไปจนกว่าคำตอบจะเป็นสิ่งที่ทีมแก้ไขได้จริง",
        ],
      },
      {
        id: "bp2",
        title: "Writing a Postmortem People Read",
        titleTh: "เขียนบันทึกหลังเหตุการณ์ที่คนอยากอ่าน",
        kind: "article",
        minutes: 15,
        summary: "A postmortem nobody reads is a meeting that happened twice.",
        summaryTh: "บันทึกหลังเหตุการณ์ที่ไม่มีใครอ่าน ก็คือการประชุมเรื่องเดิมสองรอบ",
        body:
          "Open with the timeline in plain sentences, because a shared account of what happened is what makes the rest of the discussion possible. Separate the trigger from the cause: a deploy at 14:05 may be the trigger, while the cause is that nothing verified the config before the deploy ran. Then write actions that have an owner and a date; \"be more careful\" is not an action. Keep names in the timeline where they help reconstruct the sequence, and keep them out of the causes entirely. The test of a good postmortem is simple — could a person who was not there prevent the same failure after reading it.",
        bodyTh:
          "เริ่มด้วยลำดับเหตุการณ์ที่เขียนเป็นประโยคเรียบง่าย เพราะการมีเรื่องเล่าชุดเดียวกันคือสิ่งที่ทำให้คุยเรื่องที่เหลือได้ ให้แยกตัวจุดชนวนออกจากสาเหตุ เช่น การดีพลอยเวลา 14:05 อาจเป็นตัวจุดชนวน ส่วนสาเหตุคือไม่มีอะไรตรวจค่าคอนฟิกก่อนดีพลอยจะทำงาน จากนั้นจึงเขียนสิ่งที่ต้องลงมือทำ โดยมีผู้รับผิดชอบและกำหนดวัน คำว่า “ระวังให้มากขึ้น” ไม่นับเป็นสิ่งที่ลงมือทำได้ ให้คงชื่อคนไว้ในลำดับเหตุการณ์เท่าที่ช่วยให้เข้าใจลำดับ และไม่ต้องมีชื่อคนในส่วนของสาเหตุเลย เกณฑ์วัดว่าบันทึกนี้ดีหรือไม่นั้นง่ายมาก คือคนที่ไม่ได้อยู่ในเหตุการณ์ อ่านแล้วป้องกันความผิดพลาดเดิมได้หรือไม่",
        bullets: [
          "Invites the people involved to review the process together rather than assigning blame.",
          "Turns each cause into an action with an owner and a date.",
        ],
        bulletsTh: [
          "ชวนผู้เกี่ยวข้องมาทบทวนกระบวนการร่วมกัน แทนการหาคนผิด",
          "แปลงแต่ละสาเหตุให้เป็นงานที่มีผู้รับผิดชอบและกำหนดวัน",
        ],
      },
    ],
  },

  /* -------------------------------------------------------- Core: Adaptive */
  {
    id: "learning-agility",
    title: "Learning Agility",
    titleTh: "ความคล่องตัวในการเรียนรู้",
    category: "Core",
    competencyId: "adaptive",
    hours: 7,
    lessons: 4,
    enrolled: 44,
    status: "Published",
    cover: "from-[#00b916] to-[#faa21b]",
    description:
      "Picking up a new tool or process quickly enough that the change does not cost the team a sprint.",
    descriptionTh:
      "เรียนรู้เครื่องมือหรือกระบวนการใหม่ให้เร็วพอที่การเปลี่ยนแปลงจะไม่ทำให้ทีมเสียเวลาไปทั้งรอบ",
    chapters: [
      {
        id: "la1",
        title: "Learning a New Tool in a Week",
        titleTh: "เรียนรู้เครื่องมือใหม่ภายในหนึ่งสัปดาห์",
        kind: "video",
        minutes: 16,
        summary: "Learn the ten percent you will use daily before reading the manual end to end.",
        summaryTh: "เรียนสิบเปอร์เซ็นต์ที่จะใช้ทุกวันให้ได้ก่อน ค่อยไปอ่านคู่มือทั้งเล่ม",
        bullets: [
          "Quickly learns and applies new technologies, tools, or processes when the project requires it.",
          "Starts from a real task rather than from the tutorial.",
          "Writes down the three things that confused them, for the next person.",
        ],
        bulletsTh: [
          "เรียนรู้และนำเทคโนโลยี เครื่องมือ หรือกระบวนการใหม่มาใช้ได้เร็วเมื่องานต้องการ",
          "เริ่มจากงานจริง แทนที่จะเริ่มจากบทเรียนตัวอย่าง",
          "จดสามเรื่องที่ทำให้สับสนไว้ให้คนถัดไปที่ต้องเรียนรู้ตาม",
        ],
      },
      {
        id: "la2",
        title: "The 70-20-10 Practice Plan",
        titleTh: "แผนฝึกฝนแบบ 70-20-10",
        kind: "pdf",
        pages: 11,
        minutes: 13,
        summary: "Most learning happens in the work, if the work is chosen deliberately.",
        summaryTh: "การเรียนรู้ส่วนใหญ่เกิดขึ้นในงาน ถ้างานนั้นถูกเลือกมาอย่างตั้งใจ",
        bullets: [
          "Turns a development goal into one real task on the current plan.",
          "Pairs a course with an on-the-job application within the same month.",
          "Books a review point so the learning is checked, not assumed.",
        ],
        bulletsTh: [
          "แปลงเป้าหมายการพัฒนาให้เป็นงานจริงหนึ่งชิ้นในแผนงานปัจจุบัน",
          "จับคู่หลักสูตรกับการนำไปใช้ในงานจริงภายในเดือนเดียวกัน",
          "นัดจุดทบทวนไว้ เพื่อให้การเรียนรู้ถูกตรวจสอบ ไม่ใช่แค่คาดว่าได้แล้ว",
        ],
      },
      {
        id: "la3",
        title: "Unlearning the Old Way",
        titleTh: "เลิกวิธีเดิมที่เคยได้ผล",
        kind: "article",
        minutes: 12,
        summary: "The hardest part of a new process is letting go of the one that used to work.",
        summaryTh: "ส่วนที่ยากที่สุดของกระบวนการใหม่ คือการปล่อยวิธีเดิมที่เคยได้ผล",
        body:
          "Resistance to a new way of working is rarely stubbornness; it is usually competence. The old process is where you were fast and reliable, and the new one makes you slow and visible again. Naming that honestly is what shortens it. Give the new method a fixed trial — a fortnight, a specific set of tasks — and agree in advance what evidence would make you keep it or drop it. Keep a list of what the old way did well, because a change that quietly loses a safeguard is a change that will be reversed later at a worse moment. Ask for help early: the person who asks in week one looks unsure for a day, while the person who waits until week four looks unsure for a month.",
        bodyTh:
          "การต่อต้านวิธีทำงานใหม่มักไม่ได้มาจากความดื้อ แต่มาจากความชำนาญ เพราะกระบวนการเดิมคือที่ที่คุณทำได้เร็วและไว้ใจได้ ส่วนกระบวนการใหม่ทำให้คุณช้าลงและถูกมองเห็นอีกครั้ง การพูดเรื่องนี้ออกมาตรง ๆ คือสิ่งที่ทำให้ช่วงนี้สั้นลง ให้กำหนดช่วงทดลองใช้วิธีใหม่แบบตายตัว เช่น สองสัปดาห์กับงานชุดหนึ่ง และตกลงล่วงหน้าว่าหลักฐานแบบใดที่จะทำให้ใช้ต่อหรือเลิกใช้ ควรจดไว้ด้วยว่าวิธีเดิมทำอะไรได้ดี เพราะการเปลี่ยนที่ทำให้กลไกป้องกันบางอย่างหายไปเงียบ ๆ คือการเปลี่ยนที่จะถูกย้อนกลับในจังหวะที่แย่กว่าเดิม และให้ขอความช่วยเหลือแต่เนิ่น ๆ เพราะคนที่ถามในสัปดาห์แรกจะดูไม่มั่นใจอยู่หนึ่งวัน ส่วนคนที่รอถึงสัปดาห์ที่สี่จะดูไม่มั่นใจอยู่ทั้งเดือน",
        bullets: [
          "Remains flexible and positive when priorities or tools change.",
          "Runs a time-boxed trial instead of debating the change indefinitely.",
        ],
        bulletsTh: [
          "ยังยืดหยุ่นและมีทัศนคติที่ดีเมื่อลำดับความสำคัญหรือเครื่องมือเปลี่ยน",
          "ทดลองใช้แบบกำหนดกรอบเวลา แทนการถกเถียงเรื่องการเปลี่ยนแปลงไม่จบสิ้น",
        ],
      },
    ],
  },
  {
    id: "staying-steady-under-pressure",
    title: "Staying Steady Under Pressure",
    titleTh: "ตั้งหลักได้ภายใต้แรงกดดัน",
    category: "Core",
    competencyId: "adaptive",
    hours: 5,
    lessons: 3,
    enrolled: 40,
    status: "Published",
    cover: "from-[#0b1b3f] to-[#faa21b]",
    description:
      "Holding your work quality through a hard review, a live incident, or a mistake that was yours.",
    descriptionTh:
      "รักษาคุณภาพงานไว้ได้ ทั้งตอนถูกรีวิวหนัก ตอนเกิดเหตุขัดข้อง หรือตอนที่ความผิดพลาดนั้นเป็นของคุณเอง",
    chapters: [
      {
        id: "sp1",
        title: "Receiving Direct Feedback",
        titleTh: "รับฟีดแบ็กแบบตรงไปตรงมา",
        kind: "article",
        minutes: 13,
        summary: "Separate the accuracy of the feedback from the manner of its delivery.",
        summaryTh: "แยกความถูกต้องของฟีดแบ็ก ออกจากวิธีที่มันถูกสื่อออกมา",
        body:
          "Blunt feedback arrives with two things mixed together: a claim about your work, and a style you may not have enjoyed. Level 3 behaviour is to pull them apart. Ask a clarifying question before you answer anything — \"which part specifically\" is almost always the right one — because it buys you a few seconds and usually narrows a sweeping statement into something concrete. Take notes rather than defending in the moment; you are allowed to say you will come back tomorrow with a revision. When you do come back, lead with what you changed. A person who returns with a revised version has demonstrably not let the feedback disturb the rest of their work, which is exactly the behaviour being assessed here.",
        bodyTh:
          "ฟีดแบ็กที่ตรงมาก มักมาพร้อมสองสิ่งปนกัน คือข้อสังเกตต่อผลงานของคุณ และวิธีพูดที่คุณอาจไม่ชอบ พฤติกรรมแบบระดับ 3 คือแยกสองสิ่งนี้ออกจากกัน ให้ถามคำถามเพื่อความชัดเจนก่อนจะตอบอะไร คำถามว่า “ส่วนไหนโดยเฉพาะ” มักใช้ได้เสมอ เพราะช่วยให้มีเวลาตั้งหลักสองสามวินาที และมักเปลี่ยนคำพูดกว้าง ๆ ให้กลายเป็นเรื่องที่จับต้องได้ ให้จดบันทึกแทนการโต้กลับในจังหวะนั้น คุณมีสิทธิ์บอกว่าจะกลับมาพร้อมฉบับแก้ไขในวันรุ่งขึ้น และเมื่อกลับมา ให้เริ่มด้วยสิ่งที่แก้ไปแล้ว คนที่กลับมาพร้อมงานฉบับใหม่ ได้แสดงให้เห็นแล้วว่าฟีดแบ็กไม่ได้รบกวนงานส่วนอื่นของเขา ซึ่งเป็นพฤติกรรมที่สมรรถนะนี้ประเมินพอดี",
        bullets: [
          "Listens to direct feedback without letting personal feelings disturb other work.",
          "Returns with a revised version rather than an explanation.",
        ],
        bulletsTh: [
          "รับฟังฟีดแบ็กที่ตรงไปตรงมาโดยไม่ให้ความรู้สึกส่วนตัวไปรบกวนงานอื่น",
          "กลับมาพร้อมงานฉบับแก้ไข แทนที่จะกลับมาพร้อมคำอธิบาย",
        ],
      },
      {
        id: "sp2",
        title: "Recovering After a Mistake",
        titleTh: "กลับมาตั้งหลักหลังทำผิดพลาด",
        kind: "video",
        minutes: 14,
        summary: "The measure is not whether you slipped; it is how quickly you were useful again.",
        summaryTh: "สิ่งที่วัดกันไม่ใช่ว่าพลาดหรือไม่ แต่คือกลับมาทำงานได้เร็วแค่ไหน",
        bullets: [
          "Successfully navigates ambiguity and makes sound decisions with incomplete information.",
          "Returns focus to the work quickly after a pressured moment.",
          "Turns the lesson into a concrete change rather than a resolution.",
        ],
        bulletsTh: [
          "รับมือกับความไม่ชัดเจนและตัดสินใจได้ดีแม้ข้อมูลยังไม่ครบ",
          "กลับมาโฟกัสกับงานได้เร็วหลังผ่านช่วงกดดัน",
          "เปลี่ยนบทเรียนให้เป็นการปรับที่จับต้องได้ ไม่ใช่แค่ตั้งใจว่าจะทำให้ดีขึ้น",
        ],
      },
    ],
  },

  /* --------------------------------------------------- Core: Collaboration */
  {
    id: "cross-team-collaboration",
    title: "Working Across Teams",
    titleTh: "การทำงานข้ามทีม",
    category: "Core",
    competencyId: "collaboration",
    hours: 8,
    lessons: 5,
    enrolled: 49,
    status: "Published",
    cover: "from-[#006bff] to-[#f05123]",
    description:
      "Shared goals, shared definitions of done, and disagreeing in a way that still ends with a decision.",
    descriptionTh:
      "เป้าหมายร่วม นิยามคำว่าเสร็จที่ตรงกัน และการเห็นต่างในแบบที่ยังจบลงด้วยการตัดสินใจ",
    chapters: [
      {
        id: "ct1",
        title: "The Handshake Between Teams",
        titleTh: "จุดส่งต่อระหว่างทีม",
        kind: "video",
        minutes: 15,
        summary: "Two teams that each did their part can still deliver nothing.",
        summaryTh: "สองทีมที่ต่างก็ทำส่วนของตัวเองครบ ก็ยังส่งมอบอะไรไม่ได้เลยก็เป็นไปได้",
        bullets: [
          "Works effectively and inclusively with cross-functional partners toward shared goals.",
          "Agrees who owns the joint outcome, not only the two halves.",
          "Names a single contact on each side instead of relying on a group chat.",
        ],
        bulletsTh: [
          "ทำงานร่วมกับทีมข้ามสายงานได้อย่างมีประสิทธิภาพและเปิดกว้างเพื่อเป้าหมายร่วม",
          "ตกลงว่าใครเป็นเจ้าของผลลัพธ์ร่วม ไม่ใช่เจ้าของแค่ครึ่งของตน",
          "ระบุผู้ประสานงานหลักฝ่ายละหนึ่งคน แทนการฝากไว้กับห้องแชตรวม",
        ],
      },
      {
        id: "ct2",
        title: "A Shared Definition of Done",
        titleTh: "นิยามคำว่าเสร็จที่ใช้ร่วมกัน",
        kind: "pdf",
        pages: 9,
        minutes: 11,
        summary: "Most cross-team rework is two correct answers to two different questions.",
        summaryTh: "งานข้ามทีมที่ต้องทำซ้ำส่วนใหญ่ คือคำตอบที่ถูกทั้งคู่ แต่ตอบคนละคำถาม",
        bullets: [
          "Writes the acceptance criteria down where both teams can see them.",
          "Confirms understanding by restating the other team's need in your own words.",
        ],
        bulletsTh: [
          "เขียนเกณฑ์การยอมรับงานไว้ในที่ที่ทั้งสองทีมมองเห็น",
          "ยืนยันความเข้าใจด้วยการทวนความต้องการของอีกทีมด้วยคำพูดของตนเอง",
        ],
      },
      {
        id: "ct3",
        title: "Disagreeing Without Stalling",
        titleTh: "เห็นต่างได้โดยงานไม่หยุด",
        kind: "article",
        minutes: 13,
        summary: "Disagree, decide, commit — in that order, and out loud.",
        summaryTh: "เห็นต่าง ตัดสินใจ แล้วเดินตาม ตามลำดับนี้ และพูดออกมาให้ชัด",
        body:
          "A disagreement between teams becomes expensive at the point it stops being about the decision and starts being about who concedes. Keep it cheap by writing both positions in one place, in neutral language, with what each one optimises for; most disagreements shrink once it is clear the two sides are protecting different things. Then name the decision owner — not the loudest person, the one whose scope carries the consequence — and give the decision a date. Once it is made, say plainly that you disagreed and are committing anyway; that sentence is what stops the argument reopening in every subsequent meeting.",
        bodyTh:
          "ความเห็นต่างระหว่างทีมจะเริ่มมีต้นทุนสูง ตรงจุดที่มันเลิกเป็นเรื่องของการตัดสินใจ และกลายเป็นเรื่องว่าใครจะยอมใคร วิธีทำให้ต้นทุนต่ำคือเขียนจุดยืนของทั้งสองฝ่ายไว้ในที่เดียวกันด้วยภาษากลาง พร้อมระบุว่าแต่ละฝ่ายกำลังรักษาอะไรอยู่ ความเห็นต่างส่วนใหญ่จะเล็กลงทันทีที่เห็นชัดว่าทั้งสองฝ่ายกำลังปกป้องคนละเรื่องกัน จากนั้นให้ระบุผู้มีอำนาจตัดสินใจ ซึ่งไม่ใช่คนที่เสียงดังที่สุด แต่คือคนที่ขอบเขตงานของเขาต้องรับผลนั้น แล้วกำหนดวันให้การตัดสินใจนั้น เมื่อตัดสินใจแล้ว ให้พูดออกมาตรง ๆ ว่าคุณเคยเห็นต่าง แต่จะเดินตามมตินี้ ประโยคนี้เองที่ทำให้เรื่องเดิมไม่ถูกรื้อขึ้นมาใหม่ในทุกการประชุมถัดไป",
        bullets: [
          "Resolves disagreements constructively to maintain team progress.",
          "Records the decision, the owner and the date where both teams can find it.",
        ],
        bulletsTh: [
          "คลี่คลายความเห็นต่างอย่างสร้างสรรค์เพื่อให้งานของทีมเดินหน้าต่อได้",
          "บันทึกมติ ผู้รับผิดชอบ และวันที่ ไว้ในที่ที่ทั้งสองทีมหาเจอ",
        ],
      },
    ],
  },

  /* ------------------------------------------------- Managerial: Process */
  {
    id: "process-improvement",
    title: "Process Improvement in Practice",
    titleTh: "การปรับปรุงกระบวนการทำงานจริง",
    category: "Managerial",
    competencyId: "process",
    hours: 9,
    lessons: 5,
    enrolled: 29,
    status: "Published",
    cover: "from-[#0061c8] to-[#00b916]",
    description:
      "Finding the step that actually costs the team time, and changing it without breaking the three steps around it.",
    descriptionTh:
      "หาขั้นตอนที่กินเวลาของทีมจริง ๆ แล้วเปลี่ยนมันโดยไม่ทำให้อีกสามขั้นตอนรอบข้างพัง",
    chapters: [
      {
        id: "pi1",
        title: "Find the Bottleneck",
        titleTh: "หาคอขวดให้เจอ",
        kind: "video",
        minutes: 14,
        summary: "Improving a step that is not the constraint changes nothing you can measure.",
        summaryTh: "การปรับขั้นตอนที่ไม่ใช่คอขวด จะไม่เปลี่ยนอะไรที่วัดได้เลย",
        bullets: [
          "Actively identifies bottlenecks or inefficiencies in current workflows and proposes solutions.",
          "Measures waiting time between steps, not only the work inside them.",
          "Confirms the constraint with data before proposing a change.",
        ],
        bulletsTh: [
          "ค้นหาคอขวดหรือความไม่มีประสิทธิภาพในกระบวนการปัจจุบันและเสนอแนวทางแก้ไข",
          "วัดเวลารอระหว่างขั้นตอน ไม่ใช่วัดแค่เวลาทำงานในแต่ละขั้น",
          "ยืนยันจุดคอขวดด้วยข้อมูลก่อนเสนอการเปลี่ยนแปลง",
        ],
      },
      {
        id: "pi2",
        title: "Writing an SOP People Follow",
        titleTh: "เขียนคู่มือการทำงานที่คนทำตามจริง",
        kind: "pdf",
        pages: 16,
        minutes: 18,
        summary: "A procedure is followed when it is shorter than working around it.",
        summaryTh: "ขั้นตอนการทำงานจะถูกทำตาม เมื่อมันสั้นกว่าการหาทางเลี่ยง",
        bullets: [
          "Maintains clear, accurate, and up-to-date documentation for processes and systems.",
          "Writes each step as an action with a visible outcome.",
          "Puts a review date and an owner on the document itself.",
        ],
        bulletsTh: [
          "ดูแลเอกสารกระบวนการและระบบให้ชัดเจน ถูกต้อง และเป็นปัจจุบัน",
          "เขียนแต่ละขั้นเป็นการกระทำที่มีผลลัพธ์ที่มองเห็นได้",
          "ระบุวันทบทวนและผู้รับผิดชอบไว้บนตัวเอกสารเอง",
        ],
      },
      {
        id: "pi3",
        title: "Changing a Process Without Breaking It",
        titleTh: "เปลี่ยนกระบวนการโดยไม่ทำให้พัง",
        kind: "article",
        minutes: 14,
        summary: "Pilot with one team, keep the old path open, then remove it deliberately.",
        summaryTh: "ทดลองกับทีมเดียวก่อน เปิดทางเดิมไว้ แล้วค่อยตัดทิ้งอย่างตั้งใจ",
        body:
          "Every established step exists because something once went wrong, even if nobody remembers what. Before you remove one, find out what it was protecting; if you cannot find out, that is a reason to keep it through the pilot rather than a reason to cut it. Run the new path with a single team for a fixed period, with the old path still available, and watch the measure you chose at the start. Announce the removal of the old path as its own event with a date, so people stop maintaining two habits. Close by updating the document the same week — a process change that is not written down is a change that reverts the moment the person who championed it takes leave.",
        bodyTh:
          "ทุกขั้นตอนที่ตั้งไว้แล้ว มักเกิดขึ้นเพราะเคยมีอะไรผิดพลาดมาก่อน แม้จะไม่มีใครจำได้แล้วว่าเรื่องอะไร ก่อนจะตัดขั้นตอนใดออก ให้หาให้เจอว่ามันกำลังป้องกันอะไรอยู่ ถ้าหาไม่เจอ นั่นเป็นเหตุผลให้เก็บไว้ตลอดช่วงทดลอง ไม่ใช่เหตุผลให้ตัดทิ้ง ให้ทดลองเส้นทางใหม่กับทีมเดียวในกรอบเวลาที่กำหนด โดยยังเปิดเส้นทางเดิมไว้ และเฝ้าดูตัวชี้วัดที่เลือกไว้ตั้งแต่ต้น เมื่อจะยกเลิกเส้นทางเดิม ให้ประกาศเป็นเหตุการณ์ของตัวเองพร้อมกำหนดวัน เพื่อให้คนเลิกดูแลสองวิธีพร้อมกัน และให้ปิดท้ายด้วยการปรับเอกสารภายในสัปดาห์เดียวกัน เพราะการเปลี่ยนกระบวนการที่ไม่ได้เขียนไว้ คือการเปลี่ยนที่จะย้อนกลับทันทีที่คนผลักดันเรื่องนี้ลาหยุด",
        bullets: [
          "Follows established standard operating procedures and best practices consistently.",
          "Pilots the change with one team before rolling it out.",
        ],
        bulletsTh: [
          "ปฏิบัติตามขั้นตอนมาตรฐานและแนวปฏิบัติที่ดีอย่างสม่ำเสมอ",
          "ทดลองการเปลี่ยนแปลงกับทีมเดียวก่อนจะขยายผลทั้งองค์กร",
        ],
      },
    ],
  },

  /* -------------------------------------------------- Managerial: Purpose */
  {
    id: "strategy-to-daily-work",
    title: "From Strategy to Daily Work",
    titleTh: "จากกลยุทธ์สู่งานประจำวัน",
    category: "Managerial",
    competencyId: "purpose",
    hours: 8,
    lessons: 4,
    enrolled: 26,
    status: "Published",
    cover: "from-[#1c1e29] to-[#faa21b]",
    description:
      "Drawing the line from the company goal to the task in front of your team, and being able to explain it twice.",
    descriptionTh:
      "ลากเส้นจากเป้าหมายองค์กรมาถึงงานตรงหน้าของทีม และอธิบายเส้นนั้นซ้ำได้เมื่อถูกถาม",
    chapters: [
      {
        id: "sd1",
        title: "The Line From Goal to Task",
        titleTh: "เส้นจากเป้าหมายมาถึงงาน",
        kind: "video",
        minutes: 15,
        summary: "If the line takes more than three hops, one of the hops is decoration.",
        summaryTh: "ถ้าเส้นนี้ต้องต่อเกินสามทอด แสดงว่าทอดใดทอดหนึ่งเป็นแค่ของประดับ",
        bullets: [
          "Clearly connects personal and team objectives to the company's long-term mission.",
          "Links each quarterly goal to at least one live piece of work.",
          "Drops or renegotiates work that cannot be connected at all.",
        ],
        bulletsTh: [
          "เชื่อมโยงเป้าหมายของตนเองและของทีมเข้ากับพันธกิจระยะยาวขององค์กรได้ชัดเจน",
          "โยงเป้าหมายรายไตรมาสแต่ละข้อเข้ากับงานที่กำลังทำอยู่จริงอย่างน้อยหนึ่งงาน",
          "ยกเลิกหรือเจรจาใหม่กับงานที่เชื่อมโยงกับเป้าหมายไม่ได้เลย",
        ],
      },
      {
        id: "sd2",
        title: "Explaining the Why",
        titleTh: "อธิบายว่าทำไปทำไม",
        kind: "article",
        minutes: 13,
        summary: "People execute a reason more reliably than they execute an instruction.",
        summaryTh: "คนทำตามเหตุผลได้แม่นยำกว่าทำตามคำสั่ง",
        body:
          "The reason to explain the why is not motivation, though it helps; it is decision quality. A person who knows the goal can handle the case you did not anticipate, and there is always a case you did not anticipate. Explain it in the listener's terms — for an engineer, what changes in the system; for a support colleague, what changes for the customer. Then check the explanation landed by asking what they would do in a specific edge case, rather than asking whether it is clear, because the answer to that is always yes. Repeat the why at the start of the work and again at the review; a reason given once at kickoff has usually decayed by the second month.",
        bodyTh:
          "เหตุผลที่ต้องอธิบายว่าทำไปทำไม ไม่ใช่เรื่องแรงจูงใจเป็นหลัก แม้จะช่วยก็ตาม แต่เป็นเรื่องคุณภาพของการตัดสินใจ คนที่รู้เป้าหมายจะรับมือกับกรณีที่คุณคาดไม่ถึงได้ และมักจะมีกรณีที่คาดไม่ถึงเสมอ ให้อธิบายด้วยภาษาของผู้ฟัง ถ้าเป็นวิศวกรให้บอกว่าอะไรจะเปลี่ยนในระบบ ถ้าเป็นทีมดูแลลูกค้าให้บอกว่าอะไรจะเปลี่ยนสำหรับลูกค้า จากนั้นตรวจว่าคำอธิบายไปถึงจริงหรือไม่ ด้วยการถามว่าถ้าเจอกรณีเฉพาะแบบนี้จะทำอย่างไร แทนการถามว่าชัดเจนไหม เพราะคำตอบของคำถามนั้นคือชัดเจนเสมอ และให้ทวนเหตุผลอีกครั้งทั้งตอนเริ่มงานและตอนทบทวน เพราะเหตุผลที่บอกครั้งเดียวตอนเปิดงาน มักจางไปแล้วเมื่อถึงเดือนที่สอง",
        bullets: [
          "Helps others understand the value and impact of their contributions to the big picture.",
          "Checks understanding with a scenario, not with “is that clear?”.",
        ],
        bulletsTh: [
          "ช่วยให้ผู้อื่นเข้าใจคุณค่าและผลกระทบของงานตนเองต่อภาพรวม",
          "ตรวจความเข้าใจด้วยสถานการณ์สมมติ ไม่ใช่ด้วยคำถามว่าชัดเจนไหม",
        ],
      },
      {
        id: "sd3",
        title: "Team Goal Canvas",
        titleTh: "ผังเป้าหมายของทีม",
        kind: "pdf",
        pages: 10,
        minutes: 12,
        summary: "One page the team can point at in a planning meeting.",
        summaryTh: "หน้าเดียวที่ทีมชี้ถึงได้ในการประชุมวางแผน",
        bullets: [
          "Demonstrates commitment by acting with clear intention in everyday tasks.",
          "Keeps the goal, the measure and the current work visible on one page.",
        ],
        bulletsTh: [
          "แสดงความมุ่งมั่นด้วยการทำงานประจำวันอย่างมีเจตนาที่ชัดเจน",
          "แสดงเป้าหมาย ตัวชี้วัด และงานที่ทำอยู่ ไว้ในหน้าเดียวให้เห็นตลอด",
        ],
      },
    ],
  },

  /* --------------------------------------------------- Managerial: Result */
  {
    id: "goal-setting-and-kpis",
    title: "Goal Setting and KPIs",
    titleTh: "การตั้งเป้าหมายและตัวชี้วัด",
    category: "Managerial",
    competencyId: "result",
    hours: 9,
    lessons: 5,
    enrolled: 34,
    status: "Published",
    cover: "from-[#faa21b] to-[#0061c8]",
    description:
      "Targets with a quantity and a quality bar, written so that missing them is visible early rather than at the deadline.",
    descriptionTh:
      "เป้าหมายที่มีทั้งเชิงปริมาณและเกณฑ์คุณภาพ เขียนไว้ให้เห็นแต่เนิ่น ๆ ว่ากำลังจะพลาด ไม่ใช่รู้ตอนถึงกำหนดส่ง",
    chapters: [
      {
        id: "gk1",
        title: "A Target You Can Miss",
        titleTh: "เป้าหมายที่พลาดได้",
        kind: "video",
        minutes: 15,
        summary: "A goal you cannot fail is a description of what you were going to do anyway.",
        summaryTh: "เป้าหมายที่ไม่มีทางพลาด คือคำบรรยายสิ่งที่คุณจะทำอยู่แล้ว",
        bullets: [
          "Plans work with indicators covering both quantity and quality.",
          "States the threshold that counts as a miss, in advance.",
          "Sets targets that are demanding but reachable within the period.",
        ],
        bulletsTh: [
          "วางแผนงานพร้อมตัวชี้วัดทั้งด้านปริมาณและคุณภาพ",
          "ระบุเกณฑ์ที่ถือว่าไม่ผ่านไว้ล่วงหน้า",
          "ตั้งเป้าที่ท้าทายแต่ยังทำได้จริงภายในรอบเวลานั้น",
        ],
      },
      {
        id: "gk2",
        title: "Writing KPIs That Survive Review",
        titleTh: "เขียน KPI ที่ผ่านการทบทวนได้",
        kind: "pdf",
        pages: 13,
        minutes: 16,
        summary: "Weight the few that matter; a KPI set with eleven rows has no priorities.",
        summaryTh: "ให้น้ำหนักกับข้อที่สำคัญจริง ชุด KPI ที่มีสิบเอ็ดข้อ เท่ากับไม่มีลำดับความสำคัญ",
        bullets: [
          "Ties each indicator to a data source that already exists.",
          "Assigns weights so the trade-offs between indicators are explicit.",
          "Agrees the review cadence at the same time as the target.",
        ],
        bulletsTh: [
          "ผูกตัวชี้วัดแต่ละข้อเข้ากับแหล่งข้อมูลที่มีอยู่แล้วจริง",
          "กำหนดน้ำหนักเพื่อให้เห็นชัดว่าต้องแลกอะไรกับอะไร",
          "ตกลงรอบการทบทวนไปพร้อมกับการตกลงเป้าหมาย",
        ],
      },
      {
        id: "gk3",
        title: "Quality Criteria, Written Down",
        titleTh: "เกณฑ์คุณภาพที่เขียนไว้เป็นลายลักษณ์อักษร",
        kind: "article",
        minutes: 12,
        summary: "Finishing on time with unstable quality is the level 2 pattern.",
        summaryTh: "เสร็จตรงเวลาแต่คุณภาพไม่คงที่ คือรูปแบบของระดับ 2",
        body:
          "The diagnostic for this competency is quality that varies run to run: the work lands on the date, but whether it is good depends on how much time was left. The fix is not effort, it is a written bar. Decide what \"acceptable\" means for this kind of output before the work starts — the checks that must pass, the reviewer who must sign, the cases that must be covered — and treat that bar as part of the deadline rather than as something negotiable when the deadline gets close. Then check against the bar at the midpoint, not at the end. Teams that only inspect near the deadline are structurally forced to trade quality for the date, every time.",
        bodyTh:
          "อาการที่บ่งชี้สมรรถนะข้อนี้คือคุณภาพที่แกว่งไปมาในแต่ละรอบ งานเสร็จตรงวัน แต่จะดีหรือไม่ขึ้นอยู่กับว่าเหลือเวลาเท่าไร ทางแก้ไม่ใช่การออกแรงมากขึ้น แต่คือการมีเกณฑ์ที่เขียนไว้ ให้ตัดสินก่อนเริ่มงานว่าคำว่า “รับได้” ของงานประเภทนี้หมายถึงอะไร เช่น การตรวจอะไรบ้างที่ต้องผ่าน ใครต้องเป็นผู้อนุมัติ และต้องครอบคลุมกรณีใดบ้าง แล้วถือว่าเกณฑ์นั้นเป็นส่วนหนึ่งของกำหนดส่ง ไม่ใช่สิ่งที่ต่อรองได้เมื่อใกล้ถึงวัน จากนั้นให้ตรวจเทียบกับเกณฑ์ตั้งแต่ช่วงกลางทาง ไม่ใช่ตอนจบ เพราะทีมที่ตรวจเฉพาะตอนใกล้กำหนด จะถูกบังคับเชิงโครงสร้างให้แลกคุณภาพกับวันส่งทุกครั้ง",
        bullets: [
          "Maintains consistent quality standards and invites the team to use the same approach.",
          "Checks the work against the written bar at the midpoint, not at the deadline.",
        ],
        bulletsTh: [
          "รักษามาตรฐานคุณภาพให้สม่ำเสมอ และชวนทีมใช้แนวทางเดียวกัน",
          "ตรวจงานเทียบกับเกณฑ์ที่เขียนไว้ตั้งแต่ช่วงกลางทาง ไม่ใช่ตอนใกล้กำหนดส่ง",
        ],
      },
    ],
  },
  {
    id: "delivery-cadence",
    title: "Delivery Cadence and Follow-Through",
    titleTh: "จังหวะการติดตามงานให้ส่งมอบได้",
    category: "Managerial",
    competencyId: "result",
    hours: 6,
    lessons: 3,
    enrolled: 23,
    status: "Published",
    cover: "from-[#00b916] to-[#f05123]",
    description:
      "Tracking on a rhythm so that a slipping plan is visible in week one instead of the final week.",
    descriptionTh:
      "ติดตามงานเป็นจังหวะ เพื่อให้เห็นตั้งแต่สัปดาห์แรกว่าแผนกำลังหลุด ไม่ใช่รู้เอาสัปดาห์สุดท้าย",
    chapters: [
      {
        id: "dc1",
        title: "Check In on a Rhythm, Not on a Panic",
        titleTh: "ติดตามตามจังหวะ ไม่ใช่ตามความตกใจ",
        kind: "video",
        minutes: 13,
        summary: "Tracking only near the deadline guarantees a rush and unstable quality.",
        summaryTh: "ติดตามเฉพาะตอนใกล้กำหนด ย่อมได้การเร่งงานและคุณภาพที่ไม่คงที่แน่นอน",
        bullets: [
          "Follows up on a fixed cycle so work finishes on time and to standard.",
          "Reviews the leading indicator, not only the completion percentage.",
          "Keeps the check-in short enough that it survives a busy week.",
        ],
        bulletsTh: [
          "ติดตามงานตามรอบที่กำหนด เพื่อให้งานเสร็จตรงเวลาและได้มาตรฐาน",
          "ดูตัวชี้วัดนำ ไม่ใช่ดูแค่เปอร์เซ็นต์ความคืบหน้า",
          "ทำให้การติดตามสั้นพอที่จะยังทำได้ในสัปดาห์ที่ยุ่ง",
        ],
      },
      {
        id: "dc2",
        title: "Replanning Without Losing the Target",
        titleTh: "ปรับแผนโดยไม่ทิ้งเป้าหมาย",
        kind: "article",
        minutes: 14,
        summary: "Change the route when you hit an obstacle; change the destination only on purpose.",
        summaryTh: "เจออุปสรรคให้เปลี่ยนเส้นทาง ส่วนจุดหมายจะเปลี่ยนได้ก็ต่อเมื่อเป็นการตัดสินใจ",
        body:
          "When a plan slips there are only four levers: scope, date, quality bar, and people. Pulling one silently is how a team ends up delivering on time with quality nobody agreed to lower. Say out loud which lever you are pulling and get it acknowledged by whoever owns the outcome. Prefer scope: a smaller thing delivered whole is almost always worth more than a larger thing delivered half, and it keeps the quality bar intact. If the date has to move, move it once with a new plan behind it rather than in a series of week-long extensions, because repeated small slips destroy the credibility of every future estimate you give.",
        bodyTh:
          "เมื่อแผนเริ่มหลุด มีตัวแปรให้ปรับเพียงสี่อย่าง คือขอบเขตงาน วันส่ง เกณฑ์คุณภาพ และกำลังคน การแอบปรับตัวใดตัวหนึ่งเงียบ ๆ คือสาเหตุที่ทีมส่งงานทันเวลาแต่คุณภาพต่ำลงโดยไม่มีใครตกลงด้วย ให้พูดออกมาให้ชัดว่ากำลังปรับตัวไหน และให้เจ้าของผลลัพธ์รับทราบ โดยควรเลือกปรับขอบเขตงานก่อน เพราะของชิ้นเล็กที่เสร็จสมบูรณ์มักมีค่ามากกว่าของชิ้นใหญ่ที่เสร็จครึ่งเดียว และยังรักษาเกณฑ์คุณภาพไว้ได้ หากจำเป็นต้องเลื่อนวัน ให้เลื่อนครั้งเดียวพร้อมแผนใหม่รองรับ ไม่ใช่ทยอยเลื่อนทีละสัปดาห์ เพราะการเลื่อนย่อย ๆ ซ้ำ ๆ จะทำลายความน่าเชื่อถือของการประเมินเวลาทุกครั้งต่อจากนี้",
        bullets: [
          "Adjusts the way of working when obstacles appear, to protect efficiency and quality.",
          "Names which lever moved — scope, date, quality or people — and gets it agreed.",
        ],
        bulletsTh: [
          "ปรับวิธีทำงานเมื่อเจออุปสรรค เพื่อรักษาประสิทธิภาพและคุณภาพของงาน",
          "ระบุให้ชัดว่าปรับตัวแปรใด ระหว่างขอบเขตงาน วันส่ง คุณภาพ หรือกำลังคน และให้ตกลงร่วมกัน",
        ],
      },
    ],
  },

  /* ------------------------------------------------ Functional: Programming */
  {
    id: "testing-fundamentals",
    title: "Testing Fundamentals",
    titleTh: "พื้นฐานการเขียนเทสต์",
    category: "Functional",
    competencyId: "programming",
    hours: 10,
    lessons: 5,
    enrolled: 30,
    status: "Published",
    cover: "from-[#0b1b3f] to-[#00b916]",
    description:
      "Unit tests that catch real regressions, written so the next developer trusts them enough to keep them.",
    descriptionTh:
      "เขียนยูนิตเทสต์ที่จับข้อผิดพลาดย้อนกลับได้จริง และเขียนให้คนถัดไปเชื่อถือพอที่จะรักษามันไว้",
    chapters: [
      {
        id: "tf1",
        title: "What to Test First",
        titleTh: "ควรเขียนเทสต์อะไรก่อน",
        kind: "video",
        minutes: 16,
        summary: "Cover the branch that would cost money, before chasing a coverage number.",
        summaryTh: "เขียนเทสต์คลุมเส้นทางที่พลาดแล้วเสียเงินก่อน อย่าเพิ่งไล่ตามตัวเลข coverage",
        bullets: [
          "Implements comprehensive unit tests to ensure code reliability.",
          "Tests behaviour at the boundaries rather than the happy path only.",
          "Writes the failing test first when fixing a reported defect.",
        ],
        bulletsTh: [
          "เขียนยูนิตเทสต์ให้ครอบคลุมเพื่อให้โค้ดเชื่อถือได้",
          "ทดสอบพฤติกรรมที่ขอบเขตของเงื่อนไข ไม่ใช่ทดสอบแค่เส้นทางปกติ",
          "เขียนเทสต์ที่ยังไม่ผ่านก่อนเสมอเมื่อจะแก้ข้อบกพร่องที่ถูกรายงานเข้ามา",
        ],
      },
      {
        id: "tf2",
        title: "Tests as Documentation",
        titleTh: "เทสต์ในฐานะเอกสารประกอบ",
        kind: "article",
        minutes: 13,
        summary: "A test name should explain the rule to someone who never read the ticket.",
        summaryTh: "ชื่อเทสต์ควรอธิบายกติกาให้คนที่ไม่เคยอ่านทิกเก็ตเข้าใจได้",
        body:
          "Read a test suite as a reader, not as a author, and the weaknesses show immediately. Names like `test3` or `worksCorrectly` tell you the code ran; they do not tell you what the system promises. Name each test for the rule it protects — rejects an expiry date in the past, keeps the order total when a line is removed — and the suite becomes the most accurate specification the project has, because it is the only one that fails when it goes out of date. Keep one assertion concept per test so a failure names the broken rule directly, and keep setup visible inside the test rather than hidden in shared fixtures three files away.",
        bodyTh:
          "ลองอ่านชุดเทสต์ในฐานะผู้อ่าน ไม่ใช่ในฐานะคนเขียน แล้วจุดอ่อนจะปรากฏทันที ชื่ออย่าง test3 หรือ worksCorrectly บอกได้แค่ว่าโค้ดรันผ่าน แต่ไม่ได้บอกว่าระบบสัญญาอะไรไว้ ให้ตั้งชื่อเทสต์ตามกติกาที่มันปกป้อง เช่น ปฏิเสธวันหมดอายุที่เป็นอดีต หรือคงยอดรวมไว้เมื่อลบรายการหนึ่งออก แล้วชุดเทสต์จะกลายเป็นข้อกำหนดที่แม่นที่สุดของโครงการ เพราะเป็นเอกสารชนิดเดียวที่ล้มเหลวเมื่อมันล้าสมัย ให้เก็บแนวคิดการตรวจสอบหนึ่งเรื่องต่อหนึ่งเทสต์ เพื่อให้เวลาล้มเหลวจะชี้ตรงไปที่กติกาที่พัง และให้เขียนส่วนเตรียมข้อมูลไว้ในเทสต์ให้เห็น แทนที่จะซ่อนไว้ในไฟล์ร่วมที่อยู่ห่างออกไปสามไฟล์",
        bullets: [
          "Writes clean, readable code following industry best practices.",
          "Names each test for the rule it protects.",
        ],
        bulletsTh: [
          "เขียนโค้ดที่สะอาดและอ่านง่ายตามแนวปฏิบัติที่ดีของอุตสาหกรรม",
          "ตั้งชื่อเทสต์แต่ละตัวตามกติกาที่มันปกป้องไว้",
        ],
      },
      {
        id: "tf3",
        title: "Test Patterns Reference",
        titleTh: "คู่มืออ้างอิงรูปแบบการเขียนเทสต์",
        kind: "pdf",
        pages: 15,
        minutes: 17,
        summary: "Fakes, stubs and the cost of mocking what you do not own.",
        summaryTh: "fake, stub และต้นทุนของการ mock สิ่งที่ไม่ได้อยู่ในมือเรา",
        bullets: [
          "Optimizes code performance and minimizes technical debt.",
          "Chooses the lightest test double the case allows.",
          "Keeps tests independent so they can run in any order.",
        ],
        bulletsTh: [
          "ปรับปรุงประสิทธิภาพของโค้ดและลดหนี้ทางเทคนิค",
          "เลือกใช้ตัวแทนในการทดสอบแบบที่เบาที่สุดเท่าที่กรณีนั้นยอมให้",
          "ทำให้เทสต์เป็นอิสระต่อกัน เพื่อให้รันในลำดับใดก็ได้",
        ],
      },
    ],
  },

  /* --------------------------------------------- Functional: Version Control */
  {
    id: "git-in-practice",
    title: "Git in Practice",
    titleTh: "การใช้ Git ในงานจริง",
    category: "Functional",
    competencyId: "version-control",
    hours: 8,
    lessons: 4,
    enrolled: 37,
    status: "Published",
    cover: "from-[#697077] to-[#0061c8]",
    description:
      "Branches, pull requests and recovery — the daily Git skills that keep a shared repository readable.",
    descriptionTh:
      "การแตกสาขา การเปิด pull request และการกู้คืน ทักษะ Git ประจำวันที่ทำให้รีโปที่ใช้ร่วมกันยังอ่านรู้เรื่อง",
    chapters: [
      {
        id: "gp1",
        title: "History You Can Read",
        titleTh: "ประวัติการแก้ไขที่อ่านรู้เรื่อง",
        kind: "video",
        minutes: 14,
        summary: "The log is written for the person bisecting a bug in six months.",
        summaryTh: "ประวัติคอมมิตเขียนไว้ให้คนที่ต้องไล่หาบั๊กในอีกหกเดือนข้างหน้า",
        bullets: [
          "Writes clear, descriptive commit messages for better traceability.",
          "Keeps one logical change per commit.",
          "Explains why in the message body, since the diff already shows what.",
        ],
        bulletsTh: [
          "เขียนข้อความคอมมิตที่ชัดเจนเพื่อให้ตามรอยย้อนหลังได้",
          "เก็บการเปลี่ยนแปลงเชิงตรรกะหนึ่งเรื่องต่อหนึ่งคอมมิต",
          "อธิบายเหตุผลไว้ในเนื้อความ เพราะตัว diff บอกอยู่แล้วว่าเปลี่ยนอะไร",
        ],
      },
      {
        id: "gp2",
        title: "Pull Request Playbook",
        titleTh: "คู่มือการเปิด Pull Request",
        kind: "pdf",
        pages: 12,
        minutes: 14,
        summary: "A reviewable pull request is small, described, and already green.",
        summaryTh: "pull request ที่รีวิวได้จริงคือเล็ก มีคำอธิบาย และเทสต์ผ่านแล้ว",
        bullets: [
          "Follows standardized branching and merging strategies such as GitFlow.",
          "Opens the request with the context a reviewer needs to start.",
          "Splits an oversized change rather than asking for a heroic review.",
        ],
        bulletsTh: [
          "ทำตามแนวทางการแตกสาขาและรวมโค้ดที่เป็นมาตรฐาน เช่น GitFlow",
          "เปิดคำขอรีวิวพร้อมบริบทที่ผู้รีวิวต้องใช้ในการเริ่มอ่าน",
          "แยกการเปลี่ยนแปลงที่ใหญ่เกินไป แทนการขอให้รีวิวทีเดียวทั้งก้อน",
        ],
      },
      {
        id: "gp3",
        title: "Recovering From a Bad Merge",
        titleTh: "กู้คืนจากการรวมโค้ดที่ผิดพลาด",
        kind: "article",
        minutes: 12,
        summary: "Almost nothing is lost; know the three commands that prove it.",
        summaryTh: "แทบไม่มีอะไรหายจริง ขอแค่รู้จักสามคำสั่งที่พิสูจน์เรื่องนี้",
        body:
          "The panic after a bad merge or a mistaken reset comes from believing the work is gone, and it very rarely is. `git reflog` lists every position HEAD has held, including the ones no branch points at any more, so the commit you think you destroyed is usually four lines down. From there `git branch rescue <sha>` gives it a name again. For a merge that landed on a shared branch, prefer `git revert -m 1` over rewriting history: reverting is itself a commit, so everyone else's clone stays valid, whereas a force push on a shared branch turns your incident into everyone's incident. Practise these on a scratch repository once, so the first time you need them is not also the first time you type them.",
        bodyTh:
          "ความตกใจหลังรวมโค้ดผิดหรือรีเซตพลาด มาจากความเชื่อว่างานหายไปแล้ว ซึ่งแทบไม่เคยเป็นเช่นนั้น คำสั่ง git reflog จะแสดงทุกตำแหน่งที่ HEAD เคยอยู่ รวมถึงตำแหน่งที่ไม่มีสาขาใดชี้ถึงแล้ว ดังนั้นคอมมิตที่คิดว่าทำลายไปแล้วมักอยู่ห่างลงไปแค่สี่บรรทัด จากนั้นใช้ git branch rescue ตามด้วยรหัสคอมมิต เพื่อตั้งชื่อให้มันใหม่ ส่วนกรณีที่การรวมโค้ดลงไปบนสาขาที่ใช้ร่วมกันแล้ว ให้เลือกใช้ git revert -m 1 แทนการเขียนประวัติใหม่ เพราะการ revert เป็นคอมมิตในตัวมันเอง สำเนาของคนอื่นจึงยังใช้ได้ ในขณะที่การ force push บนสาขาร่วมจะเปลี่ยนเหตุการณ์ของคุณให้กลายเป็นเหตุการณ์ของทุกคน ควรฝึกคำสั่งเหล่านี้กับรีโปทดลองสักครั้ง เพื่อไม่ให้ครั้งแรกที่ต้องใช้จริงเป็นครั้งแรกที่พิมพ์มันด้วย",
        bullets: [
          "Resolves merge conflicts efficiently and performs thorough code reviews.",
          "Prefers a revert on a shared branch over rewriting published history.",
        ],
        bulletsTh: [
          "แก้ conflict ได้อย่างมีประสิทธิภาพและรีวิวโค้ดอย่างละเอียด",
          "เลือกใช้การ revert บนสาขาที่ใช้ร่วมกัน แทนการเขียนประวัติที่เผยแพร่ไปแล้วใหม่",
        ],
      },
    ],
  },

  /* -------------------------------------------------- Functional: Analytical */
  {
    id: "root-cause-analysis",
    title: "Root Cause Analysis for Engineers",
    titleTh: "การวิเคราะห์สาเหตุที่แท้จริงสำหรับวิศวกร",
    category: "Functional",
    competencyId: "analytical",
    hours: 9,
    lessons: 5,
    enrolled: 32,
    status: "Published",
    cover: "from-[#1c1e29] to-[#00b916]",
    description:
      "Moving past the immediate symptom: forming a hypothesis, testing it, and proving the cause before shipping the fix.",
    descriptionTh:
      "ก้าวข้ามอาการเฉพาะหน้า ตั้งสมมติฐาน ทดสอบ และพิสูจน์สาเหตุให้ได้ก่อนจะปล่อยการแก้ไข",
    chapters: [
      {
        id: "rc1",
        title: "Symptom, Cause, Fix",
        titleTh: "อาการ สาเหตุ และการแก้ไข",
        kind: "video",
        minutes: 15,
        summary: "Fixing the symptom buys a week and costs the same bug twice.",
        summaryTh: "แก้ที่อาการซื้อเวลาได้หนึ่งสัปดาห์ แต่ต้องจ่ายค่าบั๊กเดิมสองรอบ",
        bullets: [
          "Performs root cause analysis to solve deep-seated technical issues.",
          "Separates the symptom the user reported from the mechanism behind it.",
          "Writes the hypothesis down before starting to change code.",
        ],
        bulletsTh: [
          "วิเคราะห์สาเหตุที่แท้จริงเพื่อแก้ปัญหาเชิงเทคนิคที่ฝังลึก",
          "แยกอาการที่ผู้ใช้แจ้งมา ออกจากกลไกที่อยู่เบื้องหลัง",
          "เขียนสมมติฐานไว้ก่อนจะเริ่มแก้โค้ด",
        ],
      },
      {
        id: "rc2",
        title: "Debugging Decision Tree",
        titleTh: "ผังการตัดสินใจในการไล่หาข้อผิดพลาด",
        kind: "pdf",
        pages: 14,
        minutes: 16,
        summary: "Halve the search space with every step you take.",
        summaryTh: "ทุกก้าวที่เดิน ควรตัดพื้นที่ค้นหาลงครึ่งหนึ่ง",
        bullets: [
          "Breaks a large problem into parts that can be tested independently.",
          "Reproduces the failure reliably before attempting a fix.",
          "Records what was ruled out, so the next person does not repeat it.",
        ],
        bulletsTh: [
          "แบ่งปัญหาใหญ่ออกเป็นส่วนย่อยที่ทดสอบแยกกันได้",
          "ทำให้ข้อผิดพลาดเกิดซ้ำได้อย่างแน่นอนก่อนจะลงมือแก้",
          "บันทึกสิ่งที่ตัดออกไปแล้ว เพื่อให้คนถัดไปไม่ต้องไล่ซ้ำ",
        ],
      },
      {
        id: "rc3",
        title: "Proving the Cause Before You Fix It",
        titleTh: "พิสูจน์สาเหตุก่อนลงมือแก้",
        kind: "article",
        minutes: 13,
        summary: "If you cannot make the bug come back on demand, you have not found it.",
        summaryTh: "ถ้ายังทำให้บั๊กกลับมาตามสั่งไม่ได้ แสดงว่ายังหาไม่เจอ",
        body:
          "The strongest evidence that you understand a defect is control over it: you can turn it on and off. Reproduce the failure, apply the change, confirm it disappears, then revert the change and confirm it returns. That last step is the one most often skipped, and it is the one that catches the coincidence — the timeout that stopped firing because the machine was quieter that afternoon, not because your fix worked. Where the failure only appears under load or after days of uptime, get as close as you can: a script that recreates the sequence, or a log line proving the branch was taken. Then write down the causal chain in one paragraph. If the paragraph needs the word \"somehow\", the analysis is not finished.",
        bodyTh:
          "หลักฐานที่หนักแน่นที่สุดว่าคุณเข้าใจข้อบกพร่องนั้นจริง คือการควบคุมมันได้ คือเปิดและปิดอาการได้ตามต้องการ ให้ทำให้ปัญหาเกิดซ้ำ ใส่การแก้ไขเข้าไป ยืนยันว่าอาการหายไป จากนั้นถอนการแก้ไขออกและยืนยันว่าอาการกลับมา ขั้นตอนสุดท้ายนี้คือขั้นที่ถูกข้ามบ่อยที่สุด และเป็นขั้นที่จับความบังเอิญได้ เช่น การหมดเวลาที่หยุดเกิดเพราะเครื่องว่างกว่าเดิมในบ่ายวันนั้น ไม่ใช่เพราะการแก้ของคุณได้ผล ในกรณีที่ปัญหาเกิดเฉพาะตอนโหลดสูงหรือหลังระบบทำงานต่อเนื่องหลายวัน ให้เข้าใกล้ที่สุดเท่าที่ทำได้ เช่น เขียนสคริปต์จำลองลำดับเหตุการณ์ หรือใช้ล็อกที่พิสูจน์ว่าโค้ดเดินเข้าเส้นทางนั้นจริง แล้วจึงเขียนห่วงโซ่ของสาเหตุไว้หนึ่งย่อหน้า หากย่อหน้านั้นยังต้องใช้คำว่า “ไม่รู้ทำไม” แสดงว่าการวิเคราะห์ยังไม่จบ",
        bullets: [
          "Analyses the cause with sound reasoning and proposes workable options.",
          "Confirms the fix by removing it and watching the failure return.",
        ],
        bulletsTh: [
          "วิเคราะห์สาเหตุอย่างมีเหตุผลและเสนอแนวทางแก้ที่เป็นไปได้",
          "ยืนยันการแก้ไขด้วยการถอนออกแล้วดูว่าอาการกลับมาจริง",
        ],
      },
    ],
  },
  {
    id: "prioritisation-and-time",
    title: "Prioritisation and Time Management",
    titleTh: "การจัดลำดับงานและบริหารเวลา",
    category: "Functional",
    competencyId: "analytical",
    hours: 6,
    lessons: 4,
    enrolled: 47,
    status: "Published",
    cover: "from-[#faa21b] to-[#697077]",
    description:
      "One ranked list, an honest estimate of your own week, and a plan that survives contact with a change of scope.",
    descriptionTh:
      "รายการงานที่จัดลำดับไว้ชุดเดียว การประเมินเวลาของตนเองอย่างตรงไปตรงมา และแผนที่ยังอยู่รอดเมื่อขอบเขตงานเปลี่ยน",
    chapters: [
      {
        id: "pt1",
        title: "One List, Ranked",
        titleTh: "รายการเดียว จัดลำดับให้ชัด",
        kind: "article",
        minutes: 12,
        summary: "Work spread across four tools is work you cannot prioritise.",
        summaryTh: "งานที่กระจายอยู่ในสี่เครื่องมือ คืองานที่จัดลำดับความสำคัญไม่ได้",
        body:
          "The level 2 pattern in this competency is starting several things and finishing none, and its usual cause is that no single place holds everything. Pull the ticket queue, the chat requests and the promises made in meetings into one list, then rank it strictly — no ties, because a tie is a decision you have postponed. Work the top item until it is done or genuinely blocked, and when something new arrives, place it in the ranking rather than at the front by default; urgency is a property of the request, not of the person asking. Review the list at a fixed time each day. The discipline is not the ranking itself, it is having only one thing to look at when you have twenty minutes and a choice.",
        bodyTh:
          "รูปแบบของระดับ 2 ในสมรรถนะนี้คือเริ่มหลายงานพร้อมกันจนไม่มีอะไรเสร็จ และสาเหตุที่พบบ่อยคือไม่มีที่ใดที่เดียวที่รวบรวมงานทั้งหมดไว้ ให้ดึงคิวงานจากระบบทิกเก็ต คำขอในแชต และคำรับปากที่ให้ไว้ในที่ประชุม มารวมไว้ในรายการเดียว แล้วจัดลำดับอย่างเคร่งครัดโดยไม่ให้มีอันดับเท่ากัน เพราะอันดับที่เท่ากันคือการตัดสินใจที่ถูกเลื่อนออกไป ให้ทำงานอันดับบนสุดจนเสร็จหรือจนติดขัดจริง ๆ และเมื่อมีงานใหม่เข้ามา ให้จัดมันเข้าไปในลำดับ ไม่ใช่วางไว้หน้าสุดโดยอัตโนมัติ เพราะความเร่งด่วนเป็นคุณสมบัติของตัวงาน ไม่ใช่ของคนที่ขอ ให้ทบทวนรายการในเวลาเดิมทุกวัน วินัยที่แท้จริงไม่ใช่ตัวการจัดลำดับ แต่คือการมีที่ให้ดูเพียงที่เดียว ในจังหวะที่คุณมีเวลายี่สิบนาทีและต้องเลือก",
        bullets: [
          "Plans their own work in order of priority.",
          "Keeps every commitment in one place so the ranking is real.",
        ],
        bulletsTh: [
          "วางแผนงานของตนเองตามลำดับความสำคัญ",
          "เก็บทุกคำรับปากไว้ในที่เดียว เพื่อให้การจัดลำดับมีความหมายจริง",
        ],
      },
      {
        id: "pt2",
        title: "Estimating Your Own Week",
        titleTh: "ประเมินเวลาในสัปดาห์ของตัวเอง",
        kind: "video",
        minutes: 13,
        summary: "You do not have five days of focus time; plan the days you actually have.",
        summaryTh: "คุณไม่ได้มีเวลาโฟกัสห้าวันเต็ม ให้วางแผนจากวันที่มีอยู่จริง",
        bullets: [
          "Delivers high-quality work consistently within agreed timelines.",
          "Subtracts meetings and support duty before committing to a date.",
          "Compares the estimate with the actual at the end of the week.",
        ],
        bulletsTh: [
          "ส่งมอบงานคุณภาพสูงได้สม่ำเสมอภายในกรอบเวลาที่ตกลงไว้",
          "หักเวลาประชุมและเวรดูแลระบบออกก่อนจะรับปากกำหนดวัน",
          "เทียบเวลาที่ประเมินไว้กับเวลาที่ใช้จริงเมื่อจบสัปดาห์",
        ],
      },
      {
        id: "pt3",
        title: "Weekly Planning Template",
        titleTh: "แม่แบบการวางแผนรายสัปดาห์",
        kind: "pdf",
        pages: 8,
        minutes: 10,
        summary: "Fifteen minutes on Monday buys back an afternoon on Thursday.",
        summaryTh: "สิบห้านาทีในวันจันทร์ ซื้อเวลาคืนได้หนึ่งบ่ายในวันพฤหัสบดี",
        bullets: [
          "Prioritizes tasks effectively based on impact and urgency.",
          "Adjusts the plan when the work changes, instead of abandoning it.",
        ],
        bulletsTh: [
          "จัดลำดับงานได้อย่างเหมาะสมตามผลกระทบและความเร่งด่วน",
          "ปรับแผนเมื่องานเปลี่ยน แทนที่จะทิ้งแผนไปเลย",
        ],
      },
    ],
  },
  /* ------------------------------------- third slot: clinics, cases, labs */
  {
    id: "impact-case-dashboard",
    title: "Case Study: The Dashboard Nobody Opened",
    titleTh: "กรณีศึกษา: แดชบอร์ดที่ไม่มีใครเปิด",
    category: "Core",
    competencyId: "create-impact",
    hours: 4,
    lessons: 2,
    enrolled: 18,
    status: "Published",
    cover: "from-[#0b1b3f] to-[#697077]",
    description:
      "Six weeks of work that shipped on time, worked perfectly, and changed nothing — traced back to the one decision that caused it.",
    descriptionTh:
      "งานหกสัปดาห์ที่ส่งตรงเวลา ทำงานได้สมบูรณ์ แต่ไม่เปลี่ยนอะไรเลย ย้อนกลับไปหาการตัดสินใจข้อเดียวที่ทำให้เป็นแบบนั้น",
    chapters: [
      {
        id: "ci3a",
        title: "What the Team Actually Shipped",
        titleTh: "สิ่งที่ทีมส่งมอบจริง ๆ",
        kind: "article",
        minutes: 16,
        summary: "Everyone did their job well and the outcome was still zero.",
        summaryTh: "ทุกคนทำหน้าที่ของตัวเองได้ดี แต่ผลลัพธ์ยังเป็นศูนย์",
        body:
          "The request was for an operations dashboard, and the team delivered one: eleven charts, refreshed hourly, on time. Four months later the access log showed nineteen views, sixteen of them from the people who built it. Nothing about the execution was wrong. The failure sat in a step nobody thought of as a step — the team took the request as the goal. The person who asked wanted to stop being surprised by the Monday backlog spike, and a weekly alert on one number would have solved that in two days. Because no one asked what decision the dashboard was supposed to change, there was also no measure, so the work could neither prove nor disprove its own value. This is the level 2 pattern exactly: work completed as specified, with no clear impact and no way to show one.",
        bodyTh:
          "โจทย์ที่ได้รับคือขอแดชบอร์ดสำหรับงานปฏิบัติการ และทีมก็ส่งมอบได้จริง มีสิบเอ็ดกราฟ รีเฟรชทุกชั่วโมง ส่งตรงเวลา สี่เดือนต่อมา บันทึกการเข้าใช้งานแสดงยอดเปิดดูสิบเก้าครั้ง ซึ่งสิบหกครั้งมาจากคนที่สร้างมันเอง ไม่มีอะไรผิดในขั้นตอนการทำงานเลย ความล้มเหลวอยู่ในขั้นที่ไม่มีใครคิดว่าเป็นขั้นตอน คือทีมรับเอาคำขอมาเป็นเป้าหมายทันที คนที่ขอต้องการเลิกเซอร์ไพรส์กับงานค้างที่พุ่งขึ้นทุกวันจันทร์ ซึ่งการแจ้งเตือนรายสัปดาห์บนตัวเลขเดียวก็แก้ได้ภายในสองวัน เพราะไม่มีใครถามว่าแดชบอร์ดนี้ควรเปลี่ยนการตัดสินใจเรื่องใด จึงไม่มีตัวชี้วัดตามมาด้วย งานชิ้นนี้จึงพิสูจน์คุณค่าของตัวเองไม่ได้ ทั้งในทางบวกและทางลบ นี่คือรูปแบบของระดับ 2 พอดี คืองานเสร็จตามที่กำหนด แต่ผลลัพธ์ยังไม่มี Impact ที่ชัดเจน และวัดผลไม่ได้",
        bullets: [
          "Distinguishes the request that was made from the decision it was meant to improve.",
          "Treats the absence of a measure as a finding, not as a detail to settle later.",
        ],
        bulletsTh: [
          "แยกคำขอที่ได้รับมา ออกจากการตัดสินใจที่คำขอนั้นตั้งใจจะทำให้ดีขึ้น",
          "ถือว่าการไม่มีตัวชี้วัดคือข้อค้นพบ ไม่ใช่รายละเอียดที่ค่อยตกลงกันทีหลัง",
        ],
      },
      {
        id: "ci3b",
        title: "The Question That Would Have Caught It",
        titleTh: "คำถามที่จะดักเรื่องนี้ได้ตั้งแต่ต้น",
        kind: "video",
        minutes: 12,
        summary: "One sentence at kickoff, and the six weeks would have been two days.",
        summaryTh: "ประโยคเดียวตอนเปิดงาน หกสัปดาห์นั้นจะเหลือแค่สองวัน",
        bullets: [
          "Asks which decision changes, and how often, before scoping the work.",
          "Proposes the cheapest version that would move the same number.",
          "Agrees the measure and the review date in the kickoff itself.",
        ],
        bulletsTh: [
          "ถามว่างานนี้จะเปลี่ยนการตัดสินใจเรื่องใด และบ่อยแค่ไหน ก่อนจะกำหนดขอบเขต",
          "เสนอเวอร์ชันที่ถูกที่สุดซึ่งขยับตัวเลขเดียวกันได้",
          "ตกลงตัวชี้วัดและวันทบทวนตั้งแต่ในการประชุมเปิดงาน",
        ],
      },
    ],
  },
  {
    id: "ownership-clinic-status",
    title: "Clinic: The Status Update That Stops the Chase",
    titleTh: "คลินิกสั้น: อัปเดตสถานะที่ทำให้ไม่ต้องมีใครมาตาม",
    category: "Core",
    competencyId: "take-ownership",
    hours: 3,
    lessons: 2,
    enrolled: 62,
    status: "Published",
    cover: "from-[#faa21b] to-[#1c1e29]",
    description:
      "A short clinic for one habit: writing the update that means nobody has to ask you where the work is.",
    descriptionTh:
      "คลินิกสั้นเพื่อสร้างนิสัยเดียว คือเขียนอัปเดตที่ทำให้ไม่มีใครต้องมาถามว่างานถึงไหนแล้ว",
    chapters: [
      {
        id: "to3a",
        title: "Three Lines, Every Friday",
        titleTh: "สามบรรทัด ทุกวันศุกร์",
        kind: "video",
        minutes: 11,
        summary: "Done, next, blocked — sent before anyone asks for it.",
        summaryTh: "เสร็จอะไร ต่อด้วยอะไร ติดอะไร ส่งก่อนที่ใครจะถาม",
        bullets: [
          "Sends the update on a fixed day rather than when prompted.",
          "States the blocker with the help needed and the date it starts to hurt.",
          "Removes the need for a manager to follow up on timing or quality.",
        ],
        bulletsTh: [
          "ส่งอัปเดตในวันที่กำหนดไว้ตายตัว ไม่ใช่ส่งเมื่อถูกถาม",
          "ระบุอุปสรรคพร้อมความช่วยเหลือที่ต้องการ และวันที่เรื่องนี้จะเริ่มกระทบงาน",
          "ทำให้หัวหน้าไม่ต้องคอยติดตามเรื่องกำหนดเวลาและคุณภาพงาน",
        ],
      },
      {
        id: "to3b",
        title: "Update Templates for Four Situations",
        titleTh: "แม่แบบการอัปเดตสำหรับสี่สถานการณ์",
        kind: "pdf",
        pages: 6,
        minutes: 9,
        summary: "On track, slipping, blocked, and finished — four shapes, all short.",
        summaryTh: "ตามแผน เริ่มหลุด ติดขัด และเสร็จแล้ว สี่รูปแบบ สั้นทั้งหมด",
        bullets: [
          "Uses the slipping template early rather than the blocked one late.",
          "Closes finished work with the outcome, not only with the word done.",
        ],
        bulletsTh: [
          "ใช้แม่แบบเริ่มหลุดแต่เนิ่น ๆ ดีกว่าใช้แม่แบบติดขัดตอนสาย",
          "ปิดงานที่เสร็จด้วยผลลัพธ์ ไม่ใช่ปิดด้วยคำว่าเสร็จเฉย ๆ",
        ],
      },
    ],
  },
  {
    id: "adaptive-change-workshop",
    title: "Change Workshop: Leading a Tool Migration",
    titleTh: "เวิร์กช็อปการเปลี่ยนแปลง: นำทีมย้ายเครื่องมือ",
    category: "Core",
    competencyId: "adaptive",
    hours: 5,
    lessons: 2,
    enrolled: 15,
    status: "Draft",
    cover: "from-[#006bff] to-[#697077]",
    description:
      "A session you run with your own team the week a new tool or process lands, with the facilitator pack to run it.",
    descriptionTh:
      "กิจกรรมที่คุณจัดกับทีมของตัวเองในสัปดาห์ที่เครื่องมือหรือกระบวนการใหม่มาถึง พร้อมชุดเอกสารสำหรับผู้ดำเนินกิจกรรม",
    chapters: [
      {
        id: "ad3a",
        title: "Run the Session, Not the Announcement",
        titleTh: "จัดเวิร์กช็อป ไม่ใช่แค่ประกาศ",
        kind: "video",
        minutes: 18,
        summary: "An announcement produces compliance; a session produces a plan.",
        summaryTh: "การประกาศได้มาซึ่งการทำตาม ส่วนเวิร์กช็อปได้มาซึ่งแผน",
        bullets: [
          "Opens by collecting what the team is worried about losing.",
          "Assigns each person one task to do in the new tool during the session.",
          "Leaves with a trial period, a review date and one named helper.",
        ],
        bulletsTh: [
          "เริ่มด้วยการรวบรวมสิ่งที่ทีมกังวลว่าจะเสียไป",
          "มอบหมายให้แต่ละคนลงมือทำงานจริงหนึ่งชิ้นบนเครื่องมือใหม่ภายในกิจกรรม",
          "จบกิจกรรมด้วยช่วงทดลอง วันทบทวน และผู้ช่วยที่ระบุชื่อไว้หนึ่งคน",
        ],
      },
      {
        id: "ad3b",
        title: "Facilitator Pack: Fears, Trade-offs, Trial",
        titleTh: "ชุดเอกสารผู้ดำเนินกิจกรรม: ความกังวล สิ่งที่ต้องแลก และการทดลอง",
        kind: "pdf",
        pages: 14,
        minutes: 15,
        summary: "Timings, prompts and the two exercises that carry the session.",
        summaryTh: "ลำดับเวลา คำถามนำ และสองกิจกรรมหลักที่ขับเคลื่อนเวิร์กช็อป",
        bullets: [
          "Names what the old way did well before removing it.",
          "Records the objections so they can be answered rather than repeated.",
        ],
        bulletsTh: [
          "ระบุสิ่งที่วิธีเดิมทำได้ดีก่อนจะยกเลิกมัน",
          "บันทึกข้อโต้แย้งไว้เพื่อให้ได้รับคำตอบ แทนที่จะถูกพูดซ้ำเรื่อย ๆ",
        ],
      },
    ],
  },
  {
    id: "team-charter-workshop",
    title: "Team Charter Workshop",
    titleTh: "เวิร์กช็อปข้อตกลงการทำงานของทีม",
    category: "Core",
    competencyId: "collaboration",
    hours: 4,
    lessons: 2,
    enrolled: 41,
    status: "Published",
    cover: "from-[#faa21b] to-[#006bff]",
    description:
      "Half a day to write down how your team actually wants to work together — response times, review norms, and how disagreements end.",
    descriptionTh:
      "ครึ่งวันเพื่อเขียนให้ชัดว่าทีมของคุณอยากทำงานร่วมกันอย่างไร ทั้งเวลาตอบกลับ แนวทางการรีวิว และวิธีจบความเห็นต่าง",
    chapters: [
      {
        id: "cl3a",
        title: "The Charter Template",
        titleTh: "แม่แบบข้อตกลงการทำงาน",
        kind: "pdf",
        pages: 11,
        minutes: 13,
        summary: "Eight questions a team should be able to answer the same way.",
        summaryTh: "แปดคำถามที่ทุกคนในทีมควรตอบตรงกัน",
        bullets: [
          "Agrees response times per channel so silence stops being ambiguous.",
          "Writes down who reviews what, and how long a review may wait.",
        ],
        bulletsTh: [
          "ตกลงเวลาตอบกลับของแต่ละช่องทาง เพื่อให้ความเงียบไม่กำกวมอีกต่อไป",
          "เขียนไว้ว่าใครรีวิวอะไร และงานรอรีวิวได้นานที่สุดเท่าไร",
        ],
      },
      {
        id: "cl3b",
        title: "Facilitating the Uncomfortable Half",
        titleTh: "ดำเนินกิจกรรมในครึ่งที่อึดอัด",
        kind: "article",
        minutes: 15,
        summary: "The first half writes the easy agreements; the value is in the second.",
        summaryTh: "ครึ่งแรกได้ข้อตกลงที่ง่าย ส่วนคุณค่าจริงอยู่ในครึ่งหลัง",
        body:
          "Any team can agree in twenty minutes that meetings should start on time. The agreements that matter are the ones people avoid: what happens when a review sits untouched for three days, whether it is acceptable to reopen a decision after it was made, and how someone raises that a colleague is not carrying their share. Put those on the agenda explicitly, and go around the room so the quietest person speaks before the most senior — the level 2 pattern in this competency is avoiding negative feedback in either direction, and a round-robin removes the choice to stay silent. Write only what the whole room can live with, keep it to one page, and set a date to revisit it. A charter that is negotiated once and never reopened stops describing the team within a quarter.",
        bodyTh:
          "ทีมไหนก็ตกลงกันได้ภายในยี่สิบนาทีว่าการประชุมควรเริ่มตรงเวลา แต่ข้อตกลงที่สำคัญจริงคือเรื่องที่คนมักหลีกเลี่ยง เช่น จะทำอย่างไรเมื่องานรอรีวิวค้างอยู่สามวัน การรื้อมติที่ตัดสินไปแล้วทำได้หรือไม่ และจะพูดอย่างไรเมื่อเห็นว่าเพื่อนร่วมงานไม่ได้แบกงานตามส่วนของตน ให้ใส่เรื่องเหล่านี้ไว้ในวาระอย่างชัดเจน และให้ไล่พูดทีละคนโดยเริ่มจากคนที่เงียบที่สุดก่อนคนที่อาวุโสที่สุด เพราะรูปแบบของระดับ 2 ในสมรรถนะนี้คือการหลีกเลี่ยงฟีดแบ็กเชิงลบทั้งการให้และการรับ การไล่พูดทีละคนจึงตัดทางเลือกที่จะเงียบออกไป ให้เขียนเฉพาะข้อที่ทุกคนในห้องรับได้ เก็บให้อยู่ในหน้าเดียว และกำหนดวันกลับมาทบทวน เพราะข้อตกลงที่คุยกันครั้งเดียวแล้วไม่เคยรื้อ จะเลิกอธิบายทีมนี้ได้ภายในหนึ่งไตรมาส",
        bullets: [
          "Fosters a positive team culture by respecting diverse perspectives.",
          "Runs a round-robin so the quietest person speaks before the most senior.",
        ],
        bulletsTh: [
          "สร้างวัฒนธรรมทีมที่ดีด้วยการเคารพมุมมองที่หลากหลาย",
          "ไล่พูดทีละคน โดยให้คนที่เงียบที่สุดพูดก่อนคนที่อาวุโสที่สุด",
        ],
      },
    ],
  },
  {
    id: "process-case-eleven-approvals",
    title: "Case Study: The Release With Eleven Approvals",
    titleTh: "กรณีศึกษา: การปล่อยระบบที่ต้องขออนุมัติสิบเอ็ดครั้ง",
    category: "Managerial",
    competencyId: "process",
    hours: 3,
    lessons: 2,
    enrolled: 12,
    status: "Published",
    cover: "from-[#1c1e29] to-[#0061c8]",
    description:
      "How a two-step release grew to eleven approvals in three years, and which four could be removed safely.",
    descriptionTh:
      "การปล่อยระบบที่เคยมีสองขั้น กลายเป็นสิบเอ็ดขั้นอนุมัติได้อย่างไรในสามปี และมีสี่ขั้นไหนที่ตัดออกได้อย่างปลอดภัย",
    chapters: [
      {
        id: "pr3a",
        title: "How the Eleventh Approval Got There",
        titleTh: "ขั้นอนุมัติที่สิบเอ็ดมาจากไหน",
        kind: "article",
        minutes: 14,
        summary: "Every step was added by a reasonable person after a real incident.",
        summaryTh: "ทุกขั้นตอนถูกเพิ่มโดยคนที่มีเหตุผล หลังเกิดเหตุจริงมาแล้วทั้งนั้น",
        body:
          "Nobody designed this process; it accumulated. Tracing the history showed that seven of the eleven approvals were added within a week of a specific incident, and four of those incidents had since been made impossible by automated checks. That is the useful finding: the safeguard outlived the risk. The team mapped the real path — including the waiting time, which turned out to be eighty percent of the elapsed duration while the work itself took under a day — then took each step and asked what it was protecting and whether that protection still had no other source. Four were retired, two were merged into one review, and the remaining five were documented with a named owner. The point is not that approvals are bad. It is that a process nobody owns can only grow.",
        bodyTh:
          "ไม่มีใครออกแบบกระบวนการนี้ มันสะสมขึ้นมาเอง เมื่อไล่ประวัติย้อนกลับพบว่า เจ็ดในสิบเอ็ดขั้นอนุมัติถูกเพิ่มภายในหนึ่งสัปดาห์หลังเกิดเหตุการณ์เฉพาะเรื่อง และสี่ในเหตุการณ์เหล่านั้นถูกทำให้เกิดไม่ได้อีกแล้วด้วยการตรวจอัตโนมัติ นั่นคือข้อค้นพบที่ใช้ได้ คือกลไกป้องกันอยู่ยืนยาวกว่าความเสี่ยงที่มันป้องกัน ทีมจึงวาดเส้นทางที่เกิดขึ้นจริง รวมถึงเวลารอ ซึ่งกลายเป็นแปดสิบเปอร์เซ็นต์ของเวลาทั้งหมด ในขณะที่งานจริงใช้เวลาไม่ถึงหนึ่งวัน จากนั้นจึงหยิบทีละขั้นมาถามว่ามันกำลังป้องกันอะไร และการป้องกันนั้นยังไม่มีแหล่งอื่นทดแทนจริงหรือไม่ ผลคือยกเลิกไปสี่ขั้น รวมสองขั้นเข้าเป็นการรีวิวเดียว และที่เหลืออีกห้าขั้นถูกบันทึกไว้พร้อมชื่อผู้รับผิดชอบ ประเด็นไม่ใช่ว่าการขออนุมัติเป็นเรื่องไม่ดี แต่คือกระบวนการที่ไม่มีเจ้าของ มีแต่จะโตขึ้นอย่างเดียว",
        bullets: [
          "Traces each control back to the risk it was created for.",
          "Retires a safeguard only when another source of protection exists.",
        ],
        bulletsTh: [
          "สาวกลับไปว่าการควบคุมแต่ละข้อถูกสร้างขึ้นเพื่อความเสี่ยงเรื่องใด",
          "ยกเลิกกลไกป้องกันได้ก็ต่อเมื่อมีแหล่งป้องกันอื่นทดแทนอยู่แล้ว",
        ],
      },
      {
        id: "pr3b",
        title: "Mapping the Real Path",
        titleTh: "วาดเส้นทางที่เกิดขึ้นจริง",
        kind: "pdf",
        pages: 9,
        minutes: 12,
        summary: "Map what happens, not what the document says happens.",
        summaryTh: "วาดสิ่งที่เกิดขึ้นจริง ไม่ใช่สิ่งที่เอกสารบอกว่าเกิดขึ้น",
        bullets: [
          "Records waiting time between steps alongside the work time.",
          "Marks every step that has no named owner as a finding.",
          "Keeps the map where the team can correct it.",
        ],
        bulletsTh: [
          "บันทึกเวลารอระหว่างขั้นตอนควบคู่ไปกับเวลาทำงานจริง",
          "ทำเครื่องหมายทุกขั้นที่ไม่มีผู้รับผิดชอบระบุชื่อไว้ ให้ถือเป็นข้อค้นพบ",
          "เก็บผังไว้ในที่ที่ทีมเข้ามาแก้ให้ถูกต้องได้",
        ],
      },
    ],
  },
  {
    id: "purpose-mandate-workshop",
    title: "Workshop: Rewriting the Team Mandate",
    titleTh: "เวิร์กช็อป: เขียนขอบเขตภารกิจของทีมใหม่",
    category: "Managerial",
    competencyId: "purpose",
    hours: 6,
    lessons: 2,
    enrolled: 9,
    status: "Draft",
    cover: "from-[#0061c8] to-[#faa21b]",
    description:
      "A facilitated session that ends with two sentences your team can use to accept or decline work.",
    descriptionTh:
      "กิจกรรมที่มีผู้ดำเนินการ ซึ่งจบลงด้วยสองประโยคที่ทีมของคุณใช้ตัดสินใจรับหรือไม่รับงานได้",
    chapters: [
      {
        id: "pu3a",
        title: "Two Sentences the Team Agrees On",
        titleTh: "สองประโยคที่ทีมเห็นตรงกัน",
        kind: "video",
        minutes: 17,
        summary: "A mandate is only useful if it can turn something down.",
        summaryTh: "ขอบเขตภารกิจจะมีประโยชน์ ก็ต่อเมื่อมันปฏิเสธอะไรบางอย่างได้",
        bullets: [
          "States what the team is accountable for and what it is not.",
          "Connects the mandate to a stated organisational goal.",
          "Tests the draft against three real requests from last quarter.",
        ],
        bulletsTh: [
          "ระบุว่าทีมรับผิดชอบเรื่องใด และไม่รับผิดชอบเรื่องใด",
          "เชื่อมขอบเขตภารกิจเข้ากับเป้าหมายขององค์กรที่ประกาศไว้",
          "ทดสอบร่างนี้กับคำขอจริงสามเรื่องจากไตรมาสที่แล้ว",
        ],
      },
      {
        id: "pu3b",
        title: "Mandate Workshop Pack",
        titleTh: "ชุดเอกสารเวิร์กช็อปขอบเขตภารกิจ",
        kind: "pdf",
        pages: 13,
        minutes: 16,
        summary: "Agenda, prompts, and the long-term impact check.",
        summaryTh: "วาระ คำถามนำ และแบบตรวจผลกระทบระยะยาว",
        bullets: [
          "Checks each proposal for its long-term impact, not only the immediate fix.",
          "Assigns the follow-up so the output does not stay a poster.",
        ],
        bulletsTh: [
          "ตรวจข้อเสนอแต่ละข้อในแง่ผลกระทบระยะยาว ไม่ใช่ดูแค่การแก้เฉพาะหน้า",
          "มอบหมายผู้ติดตามผล เพื่อไม่ให้ผลลัพธ์จบลงแค่โปสเตอร์บนผนัง",
        ],
      },
    ],
  },
  {
    id: "people-clinic-first-thirty-days",
    title: "Clinic: The First Thirty Days of a New Joiner",
    titleTh: "คลินิกสั้น: สามสิบวันแรกของพนักงานใหม่",
    category: "Managerial",
    competencyId: "people",
    hours: 2,
    lessons: 2,
    enrolled: 55,
    status: "Published",
    cover: "from-[#00b916] to-[#697077]",
    description:
      "Two hours on the onboarding month: what to hand over in week one, and what to stop handing over by week four.",
    descriptionTh:
      "สองชั่วโมงว่าด้วยเดือนแรกของพนักงานใหม่ ทั้งสิ่งที่ควรส่งมอบในสัปดาห์แรก และสิ่งที่ควรเลิกป้อนให้ภายในสัปดาห์ที่สี่",
    chapters: [
      {
        id: "pe3a",
        title: "Week One Is a Checklist, Week Four Is a Conversation",
        titleTh: "สัปดาห์แรกคือเช็กลิสต์ สัปดาห์ที่สี่คือบทสนทนา",
        kind: "video",
        minutes: 13,
        summary: "Access and a first real task in week one; judgement by week four.",
        summaryTh: "สัปดาห์แรกให้สิทธิ์เข้าถึงและงานจริงชิ้นแรก สัปดาห์ที่สี่ให้ดูการตัดสินใจ",
        bullets: [
          "Gives a small real task in the first week instead of reading time only.",
          "Names one buddy separate from the manager.",
          "Reviews at day thirty against what was agreed on day one.",
        ],
        bulletsTh: [
          "ให้งานจริงชิ้นเล็ก ๆ ตั้งแต่สัปดาห์แรก แทนการให้นั่งอ่านเอกสารอย่างเดียว",
          "ระบุพี่เลี้ยงหนึ่งคนที่แยกจากหัวหน้างาน",
          "ทบทวนเมื่อครบสามสิบวันโดยเทียบกับสิ่งที่ตกลงกันไว้ในวันแรก",
        ],
      },
      {
        id: "pe3b",
        title: "Teaching the Why, Not Only the How",
        titleTh: "สอนเหตุผล ไม่ใช่สอนแค่วิธีทำ",
        kind: "article",
        minutes: 14,
        summary: "Showing the steps produces someone who has to ask again next time.",
        summaryTh: "การสอนแค่ขั้นตอน จะได้คนที่ต้องกลับมาถามใหม่ในครั้งหน้า",
        body:
          "The level 2 pattern for this competency is coaching only the procedure, and only when something has gone wrong. It feels efficient — showing the five steps takes four minutes, while explaining why the second step exists takes fifteen. The cost arrives later, when the new person meets a case the five steps do not cover and comes back to you, because you taught a lookup rather than a rule. Invert the ratio deliberately in the first month: give the reasoning first, let them attempt it, then correct. Ask what they would do before you say what you would do, even when you are in a hurry, because the answer tells you what they actually understood. And schedule the coaching rather than waiting for a problem to trigger it; coaching that only appears after mistakes teaches people that asking early is a form of failure.",
        bodyTh:
          "รูปแบบของระดับ 2 ในสมรรถนะนี้คือการโค้ชเฉพาะขั้นตอน และโค้ชเฉพาะตอนที่มีอะไรผิดพลาดแล้ว ซึ่งดูเหมือนมีประสิทธิภาพ เพราะการสาธิตห้าขั้นตอนใช้เวลาสี่นาที ในขณะที่การอธิบายว่าทำไมต้องมีขั้นที่สองใช้เวลาสิบห้านาที แต่ต้นทุนจะมาถึงทีหลัง เมื่อคนใหม่เจอกรณีที่ห้าขั้นตอนนั้นไม่ครอบคลุม แล้วต้องกลับมาถามคุณอีก เพราะสิ่งที่คุณสอนไปคือการเปิดตาราง ไม่ใช่หลักการ ให้กลับสัดส่วนนี้อย่างตั้งใจในเดือนแรก คือให้เหตุผลก่อน ปล่อยให้เขาลองทำ แล้วค่อยแก้ ให้ถามว่าเขาจะทำอย่างไรก่อนที่คุณจะบอกว่าคุณจะทำอย่างไร แม้ในตอนที่รีบ เพราะคำตอบนั้นบอกคุณว่าเขาเข้าใจอะไรไปจริง ๆ และให้นัดเวลาโค้ชไว้ล่วงหน้า แทนการรอให้ปัญหาเป็นตัวจุดชนวน เพราะการโค้ชที่โผล่มาเฉพาะหลังความผิดพลาด จะสอนให้คนเข้าใจว่าการถามแต่เนิ่น ๆ คือความล้มเหลวรูปแบบหนึ่ง",
        bullets: [
          "Actively mentors and shares knowledge to help colleagues develop their skills.",
          "Asks what the other person would do before offering the answer.",
          "Schedules coaching instead of waiting for a problem to trigger it.",
        ],
        bulletsTh: [
          "เป็นพี่เลี้ยงและแบ่งปันความรู้อย่างจริงจังเพื่อช่วยให้เพื่อนร่วมงานพัฒนาทักษะ",
          "ถามว่าอีกฝ่ายจะทำอย่างไรก่อนจะเสนอคำตอบของตนเอง",
          "นัดเวลาโค้ชไว้ล่วงหน้า แทนการรอให้ปัญหาเป็นตัวเริ่ม",
        ],
      },
    ],
  },
  {
    id: "result-case-green-dashboard",
    title: "Case Study: Every Number Green, One Customer Lost",
    titleTh: "กรณีศึกษา: ตัวเลขเขียวทุกตัว แต่เสียลูกค้าไปหนึ่งราย",
    category: "Managerial",
    competencyId: "result",
    hours: 4,
    lessons: 2,
    enrolled: 20,
    status: "Published",
    cover: "from-[#f05123] to-[#697077]",
    description:
      "A quarter that met every target on the board while the outcome those targets stood for got worse.",
    descriptionTh:
      "ไตรมาสที่ทำได้ตามเป้าทุกตัวบนกระดาน ในขณะที่ผลลัพธ์ซึ่งเป้าเหล่านั้นเป็นตัวแทน กลับแย่ลง",
    chapters: [
      {
        id: "rs3a",
        title: "The Quarter in Review",
        titleTh: "ทบทวนไตรมาสนั้น",
        kind: "article",
        minutes: 15,
        summary: "Ticket closure hit 98 percent because reopening counted as a new ticket.",
        summaryTh: "อัตราปิดงานแตะ 98 เปอร์เซ็นต์ เพราะการเปิดงานซ้ำถูกนับเป็นงานใหม่",
        body:
          "Three indicators were tracked: tickets closed, average response time, and on-time delivery. All three finished green. The customer who left cited the same issue being closed and reopened four times. Nothing was falsified — the definitions simply allowed a reopened ticket to count as a fresh one, so the number that was easiest to move was the one that moved. Two lessons carry forward. First, indicators need a paired quality bar or they will be optimised on their own terms; closure rate belongs next to reopen rate, response time next to resolution time. Second, review the indicator alongside the outcome it stands for at least once per quarter, and be willing to change it. A target the team can hit without producing the outcome is not a demanding target, it is a broken one.",
        bodyTh:
          "ไตรมาสนั้นติดตามตัวชี้วัดสามตัว คือจำนวนงานที่ปิดได้ เวลาตอบกลับเฉลี่ย และการส่งมอบตรงเวลา ทั้งสามตัวจบไตรมาสด้วยสถานะเขียว ส่วนลูกค้าที่ยกเลิกให้เหตุผลว่าปัญหาเดิมถูกปิดแล้วเปิดใหม่ถึงสี่รอบ ไม่มีใครปลอมตัวเลขเลย เพียงแต่นิยามเปิดช่องให้งานที่ถูกเปิดซ้ำถูกนับเป็นงานใหม่ ตัวเลขที่ขยับง่ายที่สุดจึงเป็นตัวเลขที่ขยับ บทเรียนที่นำไปใช้ต่อได้มีสองข้อ ข้อแรก ตัวชี้วัดต้องมีเกณฑ์คุณภาพคู่กันเสมอ ไม่เช่นนั้นมันจะถูกปรับให้ดีขึ้นตามเงื่อนไขของตัวมันเอง อัตราการปิดงานควรอยู่คู่กับอัตราการเปิดซ้ำ และเวลาตอบกลับควรอยู่คู่กับเวลาที่แก้ปัญหาได้จริง ข้อสอง ให้ทบทวนตัวชี้วัดควบคู่กับผลลัพธ์ที่มันเป็นตัวแทนอย่างน้อยไตรมาสละครั้ง และพร้อมที่จะเปลี่ยนมัน เพราะเป้าที่ทีมทำได้โดยไม่เกิดผลลัพธ์จริง ไม่ใช่เป้าที่ท้าทาย แต่คือเป้าที่พัง",
        bullets: [
          "Pairs every quantity indicator with a quality indicator.",
          "Reviews the indicator against the outcome it stands for each quarter.",
        ],
        bulletsTh: [
          "จับคู่ตัวชี้วัดเชิงปริมาณทุกตัวเข้ากับตัวชี้วัดเชิงคุณภาพ",
          "ทบทวนตัวชี้วัดเทียบกับผลลัพธ์ที่มันเป็นตัวแทนทุกไตรมาส",
        ],
      },
      {
        id: "rs3b",
        title: "Choosing the Indicator That Would Have Warned You",
        titleTh: "เลือกตัวชี้วัดที่จะเตือนคุณได้ทัน",
        kind: "video",
        minutes: 12,
        summary: "A leading indicator moves before the outcome; a lagging one confirms it after.",
        summaryTh: "ตัวชี้วัดนำจะขยับก่อนผลลัพธ์ ส่วนตัวชี้วัดตามจะยืนยันหลังจากนั้น",
        bullets: [
          "Plans indicators covering both quantity and quality.",
          "Adds one leading indicator that would surface the problem mid-quarter.",
          "Removes any indicator nobody has acted on in two cycles.",
        ],
        bulletsTh: [
          "วางตัวชี้วัดให้ครอบคลุมทั้งด้านปริมาณและคุณภาพ",
          "เพิ่มตัวชี้วัดนำหนึ่งตัวที่จะทำให้เห็นปัญหาตั้งแต่กลางไตรมาส",
          "ตัดตัวชี้วัดที่ไม่มีใครลงมือทำอะไรกับมันเลยสองรอบติดออกไป",
        ],
      },
    ],
  },
  {
    id: "refactoring-lab",
    title: "Lab: Refactoring a Legacy Module",
    titleTh: "แล็บ: ปรับโครงสร้างโมดูลเก่า",
    category: "Functional",
    competencyId: "programming",
    hours: 14,
    lessons: 2,
    enrolled: 28,
    status: "Published",
    cover: "from-[#0b1b3f] to-[#faa21b]",
    description:
      "A hands-on lab: take a 900-line module with no tests and leave with the same behaviour, a test suite, and a readable structure.",
    descriptionTh:
      "แล็บลงมือทำจริง เริ่มจากโมดูล 900 บรรทัดที่ไม่มีเทสต์เลย และจบด้วยพฤติกรรมเดิม ชุดเทสต์ และโครงสร้างที่อ่านรู้เรื่อง",
    chapters: [
      {
        id: "pg3a",
        title: "Characterisation Tests First",
        titleTh: "เขียนเทสต์อธิบายพฤติกรรมเดิมก่อน",
        kind: "video",
        minutes: 20,
        summary: "Pin the current behaviour, including the parts that look like bugs.",
        summaryTh: "ตรึงพฤติกรรมปัจจุบันไว้ให้หมด รวมถึงส่วนที่ดูเหมือนเป็นบั๊ก",
        bullets: [
          "Writes tests that capture what the code does before changing it.",
          "Keeps behaviour identical during a refactor and separates fixes into their own commits.",
          "Refactors in small steps that each leave the suite green.",
        ],
        bulletsTh: [
          "เขียนเทสต์ที่จับพฤติกรรมปัจจุบันของโค้ดไว้ก่อนจะเริ่มแก้",
          "รักษาพฤติกรรมให้เหมือนเดิมตลอดการปรับโครงสร้าง และแยกการแก้บั๊กออกเป็นคอมมิตของตัวเอง",
          "ปรับโครงสร้างทีละก้าวเล็ก ๆ โดยให้ชุดเทสต์ผ่านทุกก้าว",
        ],
      },
      {
        id: "pg3b",
        title: "Lab Sheet: Six Refactors, One Module",
        titleTh: "ใบงานแล็บ: หกการปรับโครงสร้างในหนึ่งโมดูล",
        kind: "pdf",
        pages: 20,
        minutes: 24,
        summary: "Extract, rename, invert, inject — in the order that keeps the diff reviewable.",
        summaryTh: "แยกฟังก์ชัน เปลี่ยนชื่อ กลับเงื่อนไข ฉีดสิ่งที่ต้องพึ่งพา ตามลำดับที่ทำให้ diff ยังรีวิวได้",
        bullets: [
          "Improves reusability and readability rather than only making it work.",
          "Applies basic security hygiene while the code is open.",
          "Produces a module another developer can extend without asking.",
        ],
        bulletsTh: [
          "ปรับให้นำกลับมาใช้ซ้ำได้และอ่านง่ายขึ้น ไม่ใช่แค่ทำให้ทำงานได้",
          "ใส่การป้องกันความปลอดภัยขั้นพื้นฐานไปด้วยระหว่างที่แก้โค้ดอยู่",
          "ได้โมดูลที่นักพัฒนาคนอื่นต่อยอดได้โดยไม่ต้องมาถาม",
        ],
      },
    ],
  },
  {
    id: "architecture-decision-lab",
    title: "Lab: One-Page System Design and ADRs",
    titleTh: "แล็บ: ออกแบบระบบหนึ่งหน้าและบันทึกการตัดสินใจ",
    category: "Functional",
    competencyId: "architecture",
    hours: 12,
    lessons: 2,
    enrolled: 17,
    status: "Published",
    cover: "from-[#006bff] to-[#1c1e29]",
    description:
      "Produce two artefacts for a system you own: a diagram that matches production, and the decision record behind its biggest choice.",
    descriptionTh:
      "สร้างสองชิ้นงานสำหรับระบบที่คุณดูแล คือไดอะแกรมที่ตรงกับระบบจริง และบันทึกการตัดสินใจของทางเลือกที่ใหญ่ที่สุด",
    chapters: [
      {
        id: "ar3a",
        title: "A Diagram That Matches Production",
        titleTh: "ไดอะแกรมที่ตรงกับระบบจริง",
        kind: "pdf",
        pages: 12,
        minutes: 15,
        summary: "Draw what runs, not what was planned two years ago.",
        summaryTh: "วาดสิ่งที่ทำงานอยู่จริง ไม่ใช่สิ่งที่วางแผนไว้เมื่อสองปีก่อน",
        bullets: [
          "Produces a diagram that reflects real usage rather than the original intent.",
          "Marks the trust boundaries and the data stores explicitly.",
          "Dates the diagram and names its owner.",
        ],
        bulletsTh: [
          "สร้างไดอะแกรมที่สะท้อนการใช้งานจริง ไม่ใช่สะท้อนความตั้งใจตอนเริ่มต้น",
          "ระบุขอบเขตความน่าเชื่อถือและแหล่งเก็บข้อมูลไว้อย่างชัดเจน",
          "ลงวันที่บนไดอะแกรมและระบุชื่อผู้รับผิดชอบ",
        ],
      },
      {
        id: "ar3b",
        title: "Writing an Architecture Decision Record",
        titleTh: "เขียนบันทึกการตัดสินใจเชิงสถาปัตยกรรม",
        kind: "article",
        minutes: 16,
        summary: "The options you rejected are the most valuable part of the record.",
        summaryTh: "ทางเลือกที่คุณปฏิเสธไป คือส่วนที่มีค่าที่สุดของบันทึกนี้",
        body:
          "An architecture decision record is one page with four headings: context, options considered, decision, and consequences. The heading people skip is options considered, and it is the one that earns the document its keep — eighteen months later the question is never what you chose, it is whether the alternative you dismissed was dismissed for a reason that still holds. Write the trade-off in terms of what each option optimises: throughput against operational simplicity, cost against blast radius. Under consequences, include the things that got worse, because every real decision has some. Keep the record immutable — a decision that changes gets a new record that supersedes the old one, so the history of the system stays readable. Two of these per year is enough to make the design reasoning of a team legible to whoever joins next.",
        bodyTh:
          "บันทึกการตัดสินใจเชิงสถาปัตยกรรมคือเอกสารหนึ่งหน้าที่มีสี่หัวข้อ ได้แก่ บริบท ทางเลือกที่พิจารณา การตัดสินใจ และผลที่ตามมา หัวข้อที่คนมักข้ามคือทางเลือกที่พิจารณา ซึ่งเป็นหัวข้อที่ทำให้เอกสารนี้คุ้มค่าที่สุด เพราะเมื่อผ่านไปสิบแปดเดือน คำถามไม่เคยเป็นว่าคุณเลือกอะไร แต่เป็นว่าทางเลือกที่คุณตัดทิ้งไปนั้น ถูกตัดด้วยเหตุผลที่ยังใช้ได้อยู่หรือไม่ ให้เขียนสิ่งที่ต้องแลกในแง่ว่าแต่ละทางเลือกให้ความสำคัญกับอะไร เช่น ปริมาณงานที่รองรับได้ แลกกับความง่ายในการดูแลระบบ หรือต้นทุน แลกกับวงความเสียหายเมื่อเกิดปัญหา ในหัวข้อผลที่ตามมา ให้ใส่สิ่งที่แย่ลงด้วย เพราะการตัดสินใจจริงทุกครั้งย่อมมีบางอย่างที่แย่ลง และให้เก็บบันทึกนี้ไว้โดยไม่แก้ของเดิม หากการตัดสินใจเปลี่ยน ให้เขียนบันทึกใหม่ที่แทนที่ฉบับเก่า เพื่อให้ประวัติของระบบยังอ่านรู้เรื่อง ปีละสองฉบับก็เพียงพอที่จะทำให้เหตุผลเชิงออกแบบของทีม เป็นสิ่งที่คนที่เข้ามาใหม่อ่านเข้าใจได้",
        bullets: [
          "Analyses the impact of a technology choice before committing to it.",
          "Explains the design reasoning to the team clearly and in writing.",
        ],
        bulletsTh: [
          "วิเคราะห์ผลกระทบของการเลือกเทคโนโลยีก่อนจะตัดสินใจใช้",
          "อธิบายเหตุผลเชิงออกแบบให้ทีมเข้าใจอย่างชัดเจนและเป็นลายลักษณ์อักษร",
        ],
      },
    ],
  },
  {
    id: "query-tuning-lab",
    title: "Lab: Tuning a Slow Query",
    titleTh: "แล็บ: จูนคิวรีที่ทำงานช้า",
    category: "Functional",
    competencyId: "databases",
    hours: 15,
    lessons: 2,
    enrolled: 11,
    status: "Draft",
    cover: "from-[#697077] to-[#00b916]",
    description:
      "A supplied dataset, one report query at eight seconds, and the plan-reading skills to get it under a hundred milliseconds.",
    descriptionTh:
      "ชุดข้อมูลที่เตรียมไว้ให้ คิวรีรายงานหนึ่งตัวที่ใช้เวลาแปดวินาที และทักษะการอ่านแผนการทำงานเพื่อลดให้เหลือต่ำกว่าหนึ่งร้อยมิลลิวินาที",
    chapters: [
      {
        id: "db3a",
        title: "Read the Plan Before the Query",
        titleTh: "อ่านแผนการทำงานก่อนอ่านคิวรี",
        kind: "video",
        minutes: 19,
        summary: "The plan tells you where the time went; the SQL only tells you what you asked for.",
        summaryTh: "แผนการทำงานบอกว่าเวลาหายไปตรงไหน ส่วนตัว SQL บอกแค่ว่าคุณขออะไร",
        bullets: [
          "Reads the execution plan before rewriting anything.",
          "Identifies the scan or join that dominates the cost.",
          "Selects only the columns the report actually uses.",
        ],
        bulletsTh: [
          "อ่านแผนการทำงานของคิวรีก่อนจะเริ่มเขียนใหม่",
          "ระบุการสแกนหรือการ join ที่กินต้นทุนมากที่สุด",
          "ดึงเฉพาะคอลัมน์ที่รายงานใช้จริง",
        ],
      },
      {
        id: "db3b",
        title: "Lab Sheet: From Eight Seconds to Eighty Milliseconds",
        titleTh: "ใบงานแล็บ: จากแปดวินาที เหลือแปดสิบมิลลิวินาที",
        kind: "pdf",
        pages: 17,
        minutes: 22,
        summary: "Five changes, measured one at a time, with the plan captured after each.",
        summaryTh: "ห้าการเปลี่ยนแปลง วัดผลทีละข้อ และเก็บแผนการทำงานไว้หลังทุกข้อ",
        bullets: [
          "Measures after each change instead of applying all five at once.",
          "Adds an index only when the plan justifies it, then records the write cost.",
          "Protects data integrity with the constraints the schema was missing.",
        ],
        bulletsTh: [
          "วัดผลหลังการเปลี่ยนแปลงแต่ละข้อ แทนการใส่ทั้งห้าข้อพร้อมกัน",
          "เพิ่มดัชนีเมื่อแผนการทำงานยืนยันว่าจำเป็น แล้วบันทึกต้นทุนฝั่งเขียนไว้ด้วย",
          "รักษาความถูกต้องของข้อมูลด้วยข้อบังคับที่สคีมายังขาดอยู่",
        ],
      },
    ],
  },
  {
    id: "repo-rescue-lab",
    title: "Lab: Rescuing a Broken Repository",
    titleTh: "แล็บ: กู้รีโปที่พัง",
    category: "Functional",
    competencyId: "version-control",
    hours: 3,
    lessons: 2,
    enrolled: 44,
    status: "Published",
    cover: "from-[#1c1e29] to-[#00b916]",
    description:
      "Five broken repositories to fix, plus the two-minute habit that keeps you out of four of them.",
    descriptionTh:
      "รีโปที่พังห้าแบบให้ลงมือแก้ พร้อมนิสัยสองนาทีที่ทำให้คุณไม่ต้องเจอสี่ในห้าแบบนั้นเลย",
    chapters: [
      {
        id: "vc3a",
        title: "Before You Push: The Two-Minute Habit",
        titleTh: "ก่อนจะ push: นิสัยสองนาที",
        kind: "article",
        minutes: 11,
        summary: "Most conflicts are not merge problems; they are pull problems.",
        summaryTh: "conflict ส่วนใหญ่ไม่ใช่ปัญหาตอน merge แต่เป็นปัญหาที่ไม่ได้ pull",
        body:
          "The level 2 pattern here is specific and easy to name: forgetting to pull before pushing, and packing several unrelated changes into one commit. Both are habits rather than knowledge gaps, so fix them as habits. Before every push, run two commands: fetch and rebase onto the current upstream, then read your own diff top to bottom. The rebase turns a future three-way conflict into a small one you resolve alone, with the context still in your head, instead of a large one you resolve in front of a reviewer. Reading your own diff catches the debug print, the commented-out block and the unrelated file that crept in — the three things reviewers most often send back. Two minutes, on every push, and the majority of the rescue scenarios in the next chapter never happen to you.",
        bodyTh:
          "รูปแบบของระดับ 2 ในเรื่องนี้ระบุได้ชัดและง่าย คือลืม pull ก่อน push และรวมการเปลี่ยนแปลงหลายเรื่องที่ไม่เกี่ยวกันไว้ในคอมมิตเดียว ทั้งสองอย่างเป็นเรื่องนิสัยมากกว่าเรื่องความรู้ จึงควรแก้ในฐานะนิสัย ก่อน push ทุกครั้ง ให้รันสองคำสั่ง คือ fetch แล้ว rebase ไปบนปลายทางปัจจุบัน จากนั้นอ่าน diff ของตัวเองตั้งแต่ต้นจนจบ การ rebase จะเปลี่ยน conflict สามทางที่จะเกิดในอนาคต ให้กลายเป็น conflict เล็ก ๆ ที่คุณแก้เองได้ในขณะที่ยังจำบริบทได้ แทนที่จะเป็นก้อนใหญ่ที่ต้องมาแก้ต่อหน้าผู้รีวิว ส่วนการอ่าน diff ของตัวเองจะจับคำสั่งพิมพ์สำหรับดีบัก โค้ดที่คอมเมนต์ทิ้งไว้ และไฟล์ที่หลงเข้ามาโดยไม่เกี่ยวข้อง ซึ่งเป็นสามเรื่องที่ผู้รีวิวส่งกลับบ่อยที่สุด ใช้เวลาสองนาทีทุกครั้งที่ push แล้วสถานการณ์กู้คืนส่วนใหญ่ในบทถัดไปจะไม่เกิดกับคุณเลย",
        bullets: [
          "Pulls and rebases before pushing, every time.",
          "Keeps unrelated changes out of a single commit.",
          "Reads their own diff before asking anyone else to.",
        ],
        bulletsTh: [
          "pull และ rebase ก่อน push ทุกครั้ง",
          "ไม่เอาการเปลี่ยนแปลงที่ไม่เกี่ยวกันมารวมไว้ในคอมมิตเดียว",
          "อ่าน diff ของตัวเองก่อนจะขอให้คนอื่นมาอ่าน",
        ],
      },
      {
        id: "vc3b",
        title: "Five Rescue Scenarios, Live",
        titleTh: "ห้าสถานการณ์กู้คืน ทำให้ดูสด ๆ",
        kind: "video",
        minutes: 21,
        summary: "Detached head, lost stash, wrong branch, bad rebase, force-pushed shared branch.",
        summaryTh: "หลุด detached head, stash หาย, คอมมิตผิดสาขา, rebase พลาด และ force push บนสาขาที่ใช้ร่วมกัน",
        bullets: [
          "Recovers work with reflog before assuming anything is lost.",
          "Reviews the state of the branch before merging rather than after.",
        ],
        bulletsTh: [
          "กู้งานคืนด้วย reflog ก่อนจะสรุปว่ามีอะไรหายไป",
          "ตรวจสถานะของสาขาก่อน merge ไม่ใช่ตรวจหลังจากนั้น",
        ],
      },
    ],
  },
  {
    id: "analytical-case-three-problems",
    title: "Case Study: The Incident That Was Three Problems",
    titleTh: "กรณีศึกษา: เหตุขัดข้องที่จริง ๆ แล้วมีสามปัญหา",
    category: "Functional",
    competencyId: "analytical",
    hours: 5,
    lessons: 2,
    enrolled: 25,
    status: "Published",
    cover: "from-[#f05123] to-[#0061c8]",
    description:
      "One alert, four hours, and three unrelated causes — a worked example of splitting a problem before solving it.",
    descriptionTh:
      "หนึ่งการแจ้งเตือน สี่ชั่วโมง และสามสาเหตุที่ไม่เกี่ยวกันเลย ตัวอย่างการแยกปัญหาออกจากกันก่อนลงมือแก้",
    chapters: [
      {
        id: "an3a",
        title: "One Alert, Three Causes",
        titleTh: "หนึ่งการแจ้งเตือน สามสาเหตุ",
        kind: "article",
        minutes: 16,
        summary: "The first fix worked, and the alert kept firing — because it was never one fault.",
        summaryTh: "การแก้ครั้งแรกได้ผล แต่การแจ้งเตือนก็ยังดังอยู่ เพราะมันไม่เคยเป็นปัญหาเดียว",
        body:
          "The alert said checkout latency was above threshold. The first engineer found a slow query, fixed it, and latency dropped by a third — still above threshold. That partial improvement is the most misleading signal in incident work, because it looks like confirmation. The team had assumed one fault, and the level 2 habit is exactly that: chase the first plausible cause and treat the symptom as a single thing. Splitting the traffic by route showed two populations behaving differently, which was the moment the incident became tractable. The remaining latency turned out to be a retry loop on a third-party call, plus a cache that had been silently disabled by a config change eleven days earlier. Three causes, three owners, three fixes. The lesson to carry: when a fix produces a partial improvement, the correct next step is to re-segment the data, not to look for a bigger version of the same cause.",
        bodyTh:
          "การแจ้งเตือนบอกว่าเวลาตอบสนองของขั้นตอนชำระเงินสูงเกินเกณฑ์ วิศวกรคนแรกพบคิวรีที่ช้า แก้ไข แล้วเวลาตอบสนองลดลงหนึ่งในสาม แต่ก็ยังสูงกว่าเกณฑ์อยู่ดี การดีขึ้นบางส่วนแบบนี้คือสัญญาณที่ทำให้เข้าใจผิดมากที่สุดในงานแก้เหตุขัดข้อง เพราะมันดูเหมือนเป็นการยืนยันว่ามาถูกทาง ทีมตั้งสมมติฐานไว้ว่ามีปัญหาเดียว ซึ่งเป็นนิสัยแบบระดับ 2 พอดี คือไล่ตามสาเหตุแรกที่ดูเป็นไปได้ และมองอาการเป็นก้อนเดียว เมื่อลองแยกทราฟฟิกตามเส้นทางการเรียกใช้ จึงเห็นว่ามีผู้ใช้สองกลุ่มที่มีพฤติกรรมต่างกัน และนั่นคือจังหวะที่เหตุการณ์นี้เริ่มแก้ได้ เวลาที่เหลือกลายเป็นวงจรการเรียกซ้ำไปยังบริการภายนอก บวกกับแคชที่ถูกปิดไปเงียบ ๆ จากการเปลี่ยนคอนฟิกเมื่อสิบเอ็ดวันก่อน รวมเป็นสามสาเหตุ สามผู้รับผิดชอบ และสามการแก้ไข บทเรียนที่นำไปใช้ต่อคือ เมื่อการแก้ไขให้ผลดีขึ้นเพียงบางส่วน ขั้นถัดไปที่ถูกต้องคือกลับไปแบ่งกลุ่มข้อมูลใหม่ ไม่ใช่ไปหาสาเหตุเดิมในเวอร์ชันที่ใหญ่ขึ้น",
        bullets: [
          "Breaks a symptom into separable populations before choosing a cause.",
          "Treats a partial improvement as evidence of a second cause, not of success.",
        ],
        bulletsTh: [
          "แยกอาการออกเป็นกลุ่มย่อยที่แยกจากกันได้ ก่อนจะสรุปว่าสาเหตุคืออะไร",
          "ถือว่าการดีขึ้นบางส่วนคือหลักฐานว่ามีสาเหตุที่สอง ไม่ใช่หลักฐานว่าสำเร็จแล้ว",
        ],
      },
      {
        id: "an3b",
        title: "Timeline and Triage Worksheet",
        titleTh: "ใบงานลำดับเหตุการณ์และการคัดแยก",
        kind: "pdf",
        pages: 10,
        minutes: 13,
        summary: "Write the timeline while the incident runs; triage in priority order, not arrival order.",
        summaryTh: "เขียนลำดับเหตุการณ์ระหว่างที่เหตุยังดำเนินอยู่ และคัดแยกตามลำดับความสำคัญ ไม่ใช่ตามลำดับที่เข้ามา",
        bullets: [
          "Records what was ruled out and at what time, during the incident.",
          "Ranks the parallel causes by impact so the team works the largest first.",
          "Adjusts the plan as the picture changes instead of abandoning it.",
        ],
        bulletsTh: [
          "บันทึกไว้ระหว่างเกิดเหตุว่าตัดอะไรออกไปแล้ว และตัดออกเมื่อเวลาใด",
          "จัดลำดับสาเหตุที่เกิดคู่ขนานตามผลกระทบ เพื่อให้ทีมแก้ข้อที่ใหญ่ที่สุดก่อน",
          "ปรับแผนตามภาพที่ชัดขึ้น แทนที่จะทิ้งแผนไปเลย",
        ],
      },
    ],
  },
];

export const findCourse = (id: string) => COURSES.find((c) => c.id === id);

/** Courses that develop a given competency — drives the IDP course pager. */
export const coursesForCompetency = (competencyId: string) =>
  COURSES.filter((c) => c.competencyId === competencyId);

/* ------------------------------------------------------------ learning path */

export type PathProject = {
  title: string;
  titleTh: string;
  brief: string;
  briefTh: string;
  deliverable: string;
  deliverableTh: string;
  /** points awarded when the final project is submitted */
  points: number;
};

export type LearningPath = {
  id: string;
  title: string;
  titleTh: string;
  description: string;
  descriptionTh: string;
  /** career level this path is designed for */
  targetLevel: string;
  targetLevelTh: string;
  audience: string;
  audienceTh: string;
  /** exactly five courses, in the order they should be taken */
  courseIds: string[];
  project: PathProject;
  cover: string;
};

/**
 * "ออกแบบเป็น Learning Path สำหรับหัวหน้างาน (ประกอบด้วย 5 คอร์ส + 1 โปรเจกต์)".
 * The supervisor path is built from the Managerial-linked courses; the
 * contributor path from the Functional ones.
 */
export const LEARNING_PATHS: LearningPath[] = [
  {
    id: "supervisor-track",
    title: "Supervisor Learning Path",
    titleTh: "เส้นทางการเรียนรู้สำหรับหัวหน้างาน",
    description:
      "Five courses and one team project for a new Team Lead — from running the weekly to coaching your first direct reports.",
    descriptionTh:
      "ห้าหลักสูตรและหนึ่งโปรเจกต์สำหรับหัวหน้าทีมมือใหม่ ตั้งแต่การนำประชุมประจำสัปดาห์ไปจนถึงการโค้ชลูกทีมคนแรก",
    targetLevel: "Level 3: Supervise",
    targetLevelTh: "ระดับ 3: หัวหน้างาน",
    audience: "Team Lead / Specialist Lead",
    audienceTh: "หัวหน้าทีม / หัวหน้าผู้เชี่ยวชาญ",
    cover: "from-[#006bff] to-[#0b1b3f]",
    courseIds: [
      "leadership-team-dynamics",
      "project-management-essentials",
      "coaching-and-feedback",
      "delegation-and-decisions",
      "goal-setting-and-kpis",
    ],
    project: {
      title: "Team Improvement Sprint",
      titleTh: "โปรเจกต์ปรับปรุงทีม",
      brief:
        "Pick one recurring problem in your own team, agree a measure with your manager, run a four-week improvement sprint, and report what actually changed.",
      briefTh:
        "เลือกปัญหาที่เกิดซ้ำในทีมของคุณหนึ่งเรื่อง ตกลงตัวชี้วัดกับผู้จัดการ ลงมือปรับปรุงต่อเนื่องสี่สัปดาห์ แล้วรายงานว่าเปลี่ยนแปลงอะไรได้จริง",
      deliverable:
        "A one-page summary: the problem, the change you made, the measure before and after, and what you would do differently.",
      deliverableTh:
        "สรุปหนึ่งหน้า ประกอบด้วยปัญหา สิ่งที่ลงมือเปลี่ยน ตัวเลขก่อนและหลัง และสิ่งที่จะทำต่างออกไปในครั้งหน้า",
      points: 150,
    },
  },
  {
    id: "contributor-track",
    title: "Individual Contributor Path",
    titleTh: "เส้นทางการเรียนรู้สำหรับผู้ปฏิบัติงาน",
    description:
      "Five courses and one engineering project for Operation and Senior Operation staff building depth in the Functional competencies.",
    descriptionTh:
      "ห้าหลักสูตรและหนึ่งโปรเจกต์สำหรับพนักงานระดับปฏิบัติการและปฏิบัติการอาวุโส ที่ต้องการสร้างความลึกในสมรรถนะตามสายงาน",
    targetLevel: "Level 1–2: Operation",
    targetLevelTh: "ระดับ 1–2: ปฏิบัติการ",
    audience: "Executive / Senior / Specialist",
    audienceTh: "พนักงานปฏิบัติการ / อาวุโส / ผู้เชี่ยวชาญ",
    cover: "from-[#00b916] to-[#0b1b3f]",
    courseIds: [
      "nodejs-expert",
      "clean-code-and-reviews",
      "design-system",
      "data-modelling-essentials",
      "advanced-aws",
    ],
    project: {
      title: "Production Readiness Review",
      titleTh: "โปรเจกต์ตรวจความพร้อมขึ้นระบบจริง",
      brief:
        "Take one service you own, review it against the checklist from all five courses, and fix the two highest-risk gaps you find.",
      briefTh:
        "เลือกเซอร์วิสที่คุณดูแลหนึ่งตัว ตรวจสอบตามเช็กลิสต์จากทั้งห้าหลักสูตร แล้วแก้ช่องโหว่ที่เสี่ยงที่สุดสองข้อที่พบ",
      deliverable:
        "A short readiness note: the gaps you found, the two you fixed, and the evidence that the fix worked.",
      deliverableTh:
        "บันทึกความพร้อมแบบสั้น ระบุช่องโหว่ที่พบ สองข้อที่แก้แล้ว และหลักฐานว่าการแก้ไขได้ผลจริง",
      points: 150,
    },
  },
];

export const findPath = (id: string) => LEARNING_PATHS.find((p) => p.id === id);

/** Courses of a path, resolved and in order (missing ids are dropped). */
export const pathCourses = (path: LearningPath): Course[] =>
  path.courseIds
    .map((id) => findCourse(id))
    .filter((c): c is Course => Boolean(c));

/** Synthetic key used to persist path project completion in `courseProgress`. */
export const pathProgressKey = (pathId: string) => `path:${pathId}`;
/** Synthetic key used to persist the project deliverable note in `teamNotes`. */
export const pathNoteKey = (pathId: string, personId: string) =>
  `path-note:${pathId}:${personId}`;

/** Pass mark for the post-test, in percent. */
export const PASS_MARK = 70;

/* ------------------------------------------------------------------ badges */

/** Where a badge's progress is measured from, when real state exists for it. */
export type BadgeSource = "courses" | "certificates" | "assessments" | "paths";

export type Badge = {
  id: string;
  name: string;
  nameTh?: string;
  requirement: string;
  requirementTh?: string;
  earned: boolean;
  progress?: { current: number; target: number };
  tone: string;
  /** when set, the achievements page computes progress from live state */
  source?: BadgeSource;
  target?: number;
};

export const BADGES: Badge[] = [
  { id: "code-master", name: "Code Master", nameTh: "ยอดนักเขียนโค้ด", requirement: "Complete 50 code reviews", requirementTh: "รีวิวโค้ดครบ 50 ครั้ง", earned: true, tone: "from-[#7aa7ff] to-[#f0b27a]" },
  { id: "speed-demon", name: "Speed Demon", nameTh: "ความเร็วเหนือชั้น", requirement: "Complete 10 tasks in one day", requirementTh: "ปิดงานครบ 10 งานภายในวันเดียว", earned: true, tone: "from-[#5b9bff] to-[#9ad0ff]" },
  { id: "team-player", name: "Team Player", nameTh: "เพื่อนร่วมทีมตัวจริง", requirement: "Collaborate on 20 projects", requirementTh: "ร่วมงานในโครงการครบ 20 โครงการ", earned: true, tone: "from-[#6fb1ff] to-[#c9e2ff]" },
  { id: "learning-champion", name: "Learning Champion", nameTh: "แชมป์การเรียนรู้", requirement: "Complete 5 courses", requirementTh: "เรียนจบครบ 5 หลักสูตร", earned: true, tone: "from-[#8fc0ff] to-[#ffd9a8]", source: "courses", target: 5 },
  { id: "mentor", name: "Mentor", nameTh: "พี่เลี้ยง", requirement: "Train 5 junior developers", requirementTh: "สอนงานนักพัฒนารุ่นน้องครบ 5 คน", earned: true, tone: "from-[#7aa7ff] to-[#bcd8ff]" },
  { id: "innovation-leader", name: "Innovation Leader", nameTh: "ผู้นำนวัตกรรม", requirement: "Propose 3 adopted improvements", requirementTh: "เสนอการปรับปรุงที่ถูกนำไปใช้จริง 3 เรื่อง", earned: false, progress: { current: 2, target: 3 }, tone: "from-[#e6e6e6] to-[#f2f2f2]" },
  { id: "problem-solver", name: "Problem Solver", nameTh: "นักแก้ปัญหา", requirement: "Resolve 100 bugs", requirementTh: "แก้ข้อบกพร่องครบ 100 รายการ", earned: false, progress: { current: 73, target: 100 }, tone: "from-[#e6e6e6] to-[#f2f2f2]" },
  { id: "architect", name: "Architect", nameTh: "สถาปนิกระบบ", requirement: "Design 3 system architectures", requirementTh: "ออกแบบสถาปัตยกรรมระบบ 3 ระบบ", earned: false, progress: { current: 1, target: 5 }, tone: "from-[#e6e6e6] to-[#f2f2f2]" },
  { id: "certified", name: "Certified", nameTh: "ผู้ได้รับใบรับรอง", requirement: "Earn 3 course certificates", requirementTh: "ได้รับใบรับรองหลักสูตรครบ 3 ใบ", earned: false, tone: "from-[#e6e6e6] to-[#f2f2f2]", source: "certificates", target: 3 },
  { id: "path-finisher", name: "Path Finisher", nameTh: "ผู้พิชิตเส้นทางการเรียนรู้", requirement: "Complete a full learning path", requirementTh: "เรียนจบเส้นทางการเรียนรู้ครบหนึ่งเส้นทาง", earned: false, tone: "from-[#e6e6e6] to-[#f2f2f2]", source: "paths", target: 1 },
  { id: "self-aware", name: "Self Aware", nameTh: "รู้จักตนเอง", requirement: "Submit your self assessment", requirementTh: "ส่งแบบประเมินตนเอง", earned: false, tone: "from-[#e6e6e6] to-[#f2f2f2]", source: "assessments", target: 1 },
];

/* ----------------------------------------------------------------- rewards */

export type Reward = {
  id: string;
  name: string;
  nameTh?: string;
  points: number;
  stock: number;
  image: string;
  tone: string;
};

export const REWARDS: Reward[] = [
  { id: "starbucks", name: "Starbucks 100 THB Gift Voucher", nameTh: "บัตรกำนัลสตาร์บัคส์ 100 บาท", points: 500, stock: 50, image: "voucher", tone: "from-[#0b6b3a] to-[#00b916]" },
  { id: "gold", name: "1 Baht Gold Necklaces", nameTh: "สร้อยคอทองคำ 1 บาท", points: 100000, stock: 2, image: "gold", tone: "from-[#faa21b] to-[#f7d488]" },
  { id: "tshirt", name: "1 Moby T-shirt", nameTh: "เสื้อยืด 1 Moby", points: 900, stock: 100, image: "tshirt", tone: "from-[#006bff] to-[#0061c8]" },
  { id: "tumbler", name: "Tumbler", nameTh: "แก้วเก็บความเย็น", points: 1500, stock: 15, image: "tumbler", tone: "from-[#9fd8dd] to-[#dff2f4]" },
];

export const POINT_RULES = [
  { id: "course", label: "Complete 1 course", labelTh: "เรียนจบ 1 หลักสูตร", points: 50, icon: "book" },
  { id: "assessment", label: "Complete an assessment", labelTh: "ทำแบบประเมินเสร็จ", points: 30, icon: "clipboard" },
  { id: "idp", label: "Complete IDP plan", labelTh: "ทำแผนพัฒนารายบุคคลครบ", points: 100, icon: "target" },
  { id: "streak", label: "Log in streak for 7 days", labelTh: "เข้าใช้งานต่อเนื่อง 7 วัน", points: 20, icon: "flame" },
];

/** Points awarded by the LMS flows. */
export const LMS_POINTS = {
  course: 50,
  postTest: 40,
  path: 150,
};

/* ----------------------------------------------------------- announcements */

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  channel: "Email" | "In-app" | "Both";
  publishedAt: string;
  status: "Published" | "Scheduled" | "Draft";
};

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "an1",
    title: "Q1 Assessment cycle is open",
    body: "Self assessment closes on 28 Feb. Manager review runs until 20 Mar. Please complete Core and Functional first.",
    audience: "All employees",
    channel: "Both",
    publishedAt: "2026-01-05",
    status: "Published",
  },
  {
    id: "an2",
    title: "New course: Advanced AWS",
    body: "8 lessons, 18 hours, counts toward the Software Architecture and Design competency.",
    audience: "Software Production",
    channel: "In-app",
    publishedAt: "2026-02-11",
    status: "Published",
  },
  {
    id: "an3",
    title: "Reward catalogue refresh",
    body: "New tumblers and gift vouchers added. Points earned before March still apply.",
    audience: "All employees",
    channel: "Email",
    publishedAt: "2026-03-01",
    status: "Scheduled",
  },
];

/* ------------------------------------------------------------ achievements */

export type Achievement = {
  id: string;
  name: string;
  description: string;
  criteria: string;
  points: number;
  holders: number;
  active: boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: "ach1", name: "Code Master", description: "Awarded for sustained review quality", criteria: "Complete 50 code reviews", points: 300, holders: 6, active: true },
  { id: "ach2", name: "Speed Demon", description: "Awarded for throughput in a single day", criteria: "Complete 10 tasks in one day", points: 150, holders: 11, active: true },
  { id: "ach3", name: "Team Player", description: "Awarded for cross-team contribution", criteria: "Collaborate on 20 projects", points: 250, holders: 9, active: true },
  { id: "ach4", name: "Learning Champion", description: "Awarded for LMS completion", criteria: "Complete 15 courses", points: 400, holders: 4, active: true },
  { id: "ach5", name: "Mentor", description: "Awarded for developing others", criteria: "Train 5 junior developers", points: 500, holders: 3, active: false },
];
