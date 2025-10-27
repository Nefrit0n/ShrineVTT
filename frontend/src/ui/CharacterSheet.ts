import type {
  AbilityKey,
  AbilityScores,
  ActorDTO,
  ActorPatchPayload,
} from "../api/actors";
import { ActorsApiError } from "../api/actors";

type SheetTab = "attributes" | "basics";

type CharacterSheetOptions = {
  loadActor: (actorId: string) => Promise<ActorDTO>;
  updateActor: (actorId: string, payload: ActorPatchPayload) => Promise<ActorDTO>;
  onActorUpdated?: (actor: ActorDTO) => void;
};

type FormValues = {
  name: string;
  ac: number;
  maxHP: number;
  profBonus: number;
  abilities: AbilityScores;
};

const ABILITY_KEYS: AbilityKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export class CharacterSheet {
  private readonly options: CharacterSheetOptions;
  private readonly overlay: HTMLDivElement;
  private readonly sheet: HTMLDivElement;
  private readonly headerTitle: HTMLHeadingElement;
  private readonly tabs: Map<SheetTab, HTMLButtonElement> = new Map();
  private readonly sections: Map<SheetTab, HTMLElement> = new Map();
  private readonly nameInput: HTMLInputElement;
  private readonly acInput: HTMLInputElement;
  private readonly hpInput: HTMLInputElement;
  private readonly profInput: HTMLInputElement;
  private readonly abilityInputs: Map<AbilityKey, HTMLInputElement> = new Map();
  private readonly abilityModifiers: Map<AbilityKey, HTMLElement> = new Map();
  private readonly fieldErrors: Map<string, HTMLElement> = new Map();
  private readonly statusEl: HTMLDivElement;
  private readonly saveButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly form: HTMLFormElement;

  private activeTab: SheetTab | null = null;
  private visible = false;
  private loading = false;
  private currentActor: ActorDTO | null = null;
  private currentActorId: string | null = null;
  private loadToken = 0;
  private keyListener: ((event: KeyboardEvent) => void) | null = null;

  constructor(options: CharacterSheetOptions) {
    this.options = options;

    this.overlay = document.createElement("div");
    this.overlay.className = "character-sheet-overlay";
    this.overlay.setAttribute("role", "presentation");

    this.sheet = document.createElement("div");
    this.sheet.className = "character-sheet";
    this.sheet.setAttribute("role", "dialog");
    this.sheet.setAttribute("aria-modal", "true");

    const header = document.createElement("header");
    header.className = "character-sheet__header";

    this.headerTitle = document.createElement("h2");
    this.headerTitle.textContent = "Character";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "character-sheet__close";
    closeButton.setAttribute("aria-label", "Закрыть");
    closeButton.innerHTML = "&times;";
    closeButton.addEventListener("click", () => this.close());

    header.append(this.headerTitle, closeButton);

    const tabsContainer = document.createElement("div");
    tabsContainer.className = "character-sheet__tabs";

    for (const tab of ["attributes", "basics"] as SheetTab[]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "character-sheet__tab";
      button.dataset.tab = tab;
      button.textContent = tab === "attributes" ? "Attributes" : "Basics";
      button.addEventListener("click", () => this.setActiveTab(tab));
      this.tabs.set(tab, button);
      tabsContainer.append(button);
    }

    this.form = document.createElement("form");

    this.statusEl = document.createElement("div");
    this.statusEl.className = "character-sheet__status";
    this.statusEl.setAttribute("aria-live", "polite");

    const body = document.createElement("div");
    body.className = "character-sheet__body";

    const attributesSection = document.createElement("section");
    attributesSection.className = "character-sheet__section";
    attributesSection.dataset.section = "attributes";

    const abilitiesGrid = document.createElement("div");
    abilitiesGrid.className = "character-sheet__grid character-sheet__grid--abilities";

    for (const ability of ABILITY_KEYS) {
      const card = document.createElement("div");
      card.className = "character-sheet__ability";

      const labelRow = document.createElement("div");
      labelRow.className = "character-sheet__ability-label";
      const labelText = document.createElement("span");
      labelText.textContent = ability;
      const modEl = document.createElement("span");
      modEl.className = "character-sheet__ability-mod";
      modEl.textContent = "—";
      labelRow.append(labelText, modEl);

      const inputWrapper = document.createElement("div");
      inputWrapper.className = "character-sheet__ability-input";

      const input = document.createElement("input");
      input.type = "number";
      input.inputMode = "numeric";
      input.min = "1";
      input.max = "30";
      input.step = "1";
      input.name = `ability-${ability.toLowerCase()}`;
      input.className = "character-sheet__input";
      input.addEventListener("input", () => {
        this.updateAbilityModifier(ability);
        this.setFieldError(`ability:${ability}`, null);
      });

      const errorEl = document.createElement("div");
      errorEl.className = "character-sheet__error is-hidden";

      inputWrapper.append(input, errorEl);

      card.append(labelRow, inputWrapper);
      abilitiesGrid.append(card);

      this.abilityInputs.set(ability, input);
      this.abilityModifiers.set(ability, modEl);
      this.fieldErrors.set(`ability:${ability}`, errorEl);
    }

    attributesSection.append(abilitiesGrid);

    const basicsSection = document.createElement("section");
    basicsSection.className = "character-sheet__section";
    basicsSection.dataset.section = "basics";

    const basicsGrid = document.createElement("div");
    basicsGrid.className = "character-sheet__basics";

    const createField = (
      label: string,
      type: "text" | "number",
      options: { name: string; min?: number; max?: number }
    ) => {
      const field = document.createElement("div");
      field.className = "character-sheet__field";

      const labelEl = document.createElement("label");
      labelEl.className = "character-sheet__label";
      labelEl.textContent = label;

      const input = document.createElement("input");
      input.type = type;
      if (type === "number") {
        input.inputMode = "numeric";
        input.step = "1";
      }
      if (Number.isFinite(options.min)) {
        input.min = String(options.min);
      }
      if (Number.isFinite(options.max)) {
        input.max = String(options.max);
      }
      input.name = options.name;
      input.className = "character-sheet__input";

      const errorEl = document.createElement("div");
      errorEl.className = "character-sheet__error is-hidden";

      labelEl.append(input);
      field.append(labelEl, errorEl);

      return { field, input, errorEl };
    };

    const nameField = createField("Name", "text", { name: "name" });
    this.nameInput = nameField.input;
    this.fieldErrors.set("name", nameField.errorEl);
    this.nameInput.addEventListener("input", () => this.setFieldError("name", null));

    const acField = createField("Armor Class", "number", { name: "ac", min: 1, max: 30 });
    this.acInput = acField.input;
    this.fieldErrors.set("ac", acField.errorEl);
    this.acInput.addEventListener("input", () => this.setFieldError("ac", null));

    const hpField = createField("Max HP", "number", { name: "maxHP", min: 0 });
    this.hpInput = hpField.input;
    this.fieldErrors.set("maxHP", hpField.errorEl);
    this.hpInput.addEventListener("input", () => this.setFieldError("maxHP", null));

    const profField = createField("Proficiency Bonus", "number", {
      name: "profBonus",
      min: 0,
      max: 6,
    });
    this.profInput = profField.input;
    this.fieldErrors.set("profBonus", profField.errorEl);
    this.profInput.addEventListener("input", () => this.setFieldError("profBonus", null));

    basicsGrid.append(nameField.field, acField.field, hpField.field, profField.field);
    basicsSection.append(basicsGrid);

    body.append(attributesSection, basicsSection);

    const footer = document.createElement("footer");
    footer.className = "character-sheet__footer";

    this.cancelButton = document.createElement("button");
    this.cancelButton.type = "button";
    this.cancelButton.className = "btn";
    this.cancelButton.textContent = "Cancel";
    this.cancelButton.addEventListener("click", () => this.close());

    this.saveButton = document.createElement("button");
    this.saveButton.type = "submit";
    this.saveButton.className = "btn btn--primary";
    this.saveButton.textContent = "Save";

    footer.append(this.cancelButton, this.saveButton);

    this.form.append(this.statusEl, body, footer);
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.handleSubmit();
    });

    this.sheet.append(header, tabsContainer, this.form);

    this.overlay.append(this.sheet);
    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) {
        this.close();
      }
    });

    this.sheet.addEventListener("click", (event) => event.stopPropagation());

    document.body.append(this.overlay);

    this.sections.set("attributes", attributesSection);
    this.sections.set("basics", basicsSection);

    this.setActiveTab("attributes");
    this.setStatus("Выберите актора для редактирования");
  }

  public open(actorId: string): void {
    this.visible = true;
    this.currentActorId = actorId;
    this.currentActor = null;
    this.clearErrors();
    this.setLoading(true);
    this.setStatus("Загрузка персонажа…");
    this.overlay.classList.add("is-visible");
    this.setActiveTab("attributes");

    if (!this.keyListener) {
      this.keyListener = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          this.close();
        }
      };
    }

    window.addEventListener("keydown", this.keyListener);

    const requestId = ++this.loadToken;

    this.options
      .loadActor(actorId)
      .then((actor) => {
        if (requestId !== this.loadToken) {
          return;
        }
        this.currentActor = actor;
        this.populateForm(actor);
        this.setStatus("Персонаж готов к редактированию");
        this.setLoading(false);
      })
      .catch((error) => {
        if (requestId !== this.loadToken) {
          return;
        }
        this.setLoading(false);
        const message =
          error instanceof Error ? error.message : "Не удалось загрузить персонажа";
        this.setStatus(message, "error");
      });
  }

  public close(): void {
    if (!this.visible) {
      return;
    }

    this.visible = false;
    this.overlay.classList.remove("is-visible");
    this.currentActorId = null;
    this.currentActor = null;
    this.loadToken += 1;
    this.setStatus("Выберите актора для редактирования");
    this.clearErrors();
    this.resetForm();
    this.setLoading(false);
    if (this.keyListener) {
      window.removeEventListener("keydown", this.keyListener);
    }
  }

  private setActiveTab(tab: SheetTab): void {
    this.activeTab = tab;

    for (const [key, button] of this.tabs.entries()) {
      button.classList.toggle("is-active", key === tab);
    }

    for (const [key, section] of this.sections.entries()) {
      section.classList.toggle("is-active", key === tab);
    }
  }

  private setStatus(message: string, tone: "default" | "error" | "success" = "default"): void {
    this.statusEl.textContent = message;
    this.statusEl.classList.remove("is-error", "is-success");
    if (tone === "error") {
      this.statusEl.classList.add("is-error");
    } else if (tone === "success") {
      this.statusEl.classList.add("is-success");
    }
  }

  private resetForm(): void {
    this.headerTitle.textContent = "Character";
    this.nameInput.value = "";
    this.acInput.value = "";
    this.hpInput.value = "";
    this.profInput.value = "";
    for (const ability of ABILITY_KEYS) {
      const input = this.abilityInputs.get(ability);
      if (input) {
        input.value = "";
      }
      this.updateAbilityModifier(ability);
    }
  }

  private populateForm(actor: ActorDTO): void {
    this.headerTitle.textContent = actor.name || "Character";
    this.nameInput.value = actor.name;
    this.acInput.value = String(actor.ac);
    this.hpInput.value = String(actor.maxHP);
    this.profInput.value = String(actor.profBonus);

    for (const ability of ABILITY_KEYS) {
      const value = actor.abilities?.[ability];
      const input = this.abilityInputs.get(ability);
      if (input) {
        input.value = Number.isFinite(value) ? String(value) : "";
      }
      this.updateAbilityModifier(ability);
    }
  }

  private updateAbilityModifier(ability: AbilityKey): void {
    const input = this.abilityInputs.get(ability);
    const output = this.abilityModifiers.get(ability);
    if (!input || !output) {
      return;
    }
    const value = Number.parseInt(input.value, 10);
    if (!Number.isFinite(value)) {
      output.textContent = "—";
      return;
    }
    const mod = Math.floor((value - 10) / 2);
    output.textContent = mod >= 0 ? `+${mod}` : String(mod);
  }

  private setLoading(next: boolean): void {
    this.loading = next;
    this.saveButton.disabled = next;
    this.cancelButton.disabled = next;
    for (const input of [this.nameInput, this.acInput, this.hpInput, this.profInput]) {
      input.disabled = next;
    }
    for (const abilityInput of this.abilityInputs.values()) {
      abilityInput.disabled = next;
    }
  }

  private clearErrors(): void {
    for (const [key, element] of this.fieldErrors.entries()) {
      element.textContent = "";
      element.classList.add("is-hidden");
      const input = this.getInputByFieldKey(key);
      if (input) {
        input.classList.remove("is-invalid");
      }
    }
  }

  private setFieldError(fieldKey: string, message: string | null): void {
    const element = this.fieldErrors.get(fieldKey);
    if (!element) {
      return;
    }
    if (message) {
      element.textContent = message;
      element.classList.remove("is-hidden");
    } else {
      element.textContent = "";
      element.classList.add("is-hidden");
    }
    const input = this.getInputByFieldKey(fieldKey);
    if (input) {
      input.classList.toggle("is-invalid", Boolean(message));
    }
  }

  private getInputByFieldKey(fieldKey: string): HTMLInputElement | null {
    if (fieldKey.startsWith("ability:")) {
      const key = fieldKey.split(":")[1] as AbilityKey | undefined;
      if (key && this.abilityInputs.has(key)) {
        return this.abilityInputs.get(key) ?? null;
      }
    }
    switch (fieldKey) {
      case "name":
        return this.nameInput;
      case "ac":
        return this.acInput;
      case "maxHP":
        return this.hpInput;
      case "profBonus":
        return this.profInput;
      default:
        return null;
    }
  }

  private collectFormValues(): FormValues | null {
    const abilities: Partial<AbilityScores> = {};
    let hasAbilityError = false;

    for (const ability of ABILITY_KEYS) {
      const input = this.abilityInputs.get(ability);
      if (!input) {
        continue;
      }
      const value = Number.parseInt(input.value, 10);
      if (!Number.isFinite(value)) {
        this.setFieldError(`ability:${ability}`, "Укажите значение");
        hasAbilityError = true;
        continue;
      }
      if (value < 1 || value > 30) {
        this.setFieldError(`ability:${ability}`, "1–30");
        hasAbilityError = true;
        continue;
      }
      abilities[ability] = clamp(value, 1, 30);
    }

    const name = this.nameInput.value.trim();
    if (!name) {
      this.setFieldError("name", "Имя обязательно");
    }

    const ac = Number.parseInt(this.acInput.value, 10);
    if (!Number.isFinite(ac) || ac < 1 || ac > 30) {
      this.setFieldError("ac", "Допустимо 1–30");
    }

    const maxHP = Number.parseInt(this.hpInput.value, 10);
    if (!Number.isFinite(maxHP) || maxHP < 0) {
      this.setFieldError("maxHP", "Неотрицательное число");
    }

    const profBonus = Number.parseInt(this.profInput.value, 10);
    if (!Number.isFinite(profBonus) || profBonus < 0 || profBonus > 6) {
      this.setFieldError("profBonus", "0–6");
    }

    const hasErrors =
      hasAbilityError ||
      !name ||
      !Number.isFinite(ac) ||
      ac < 1 ||
      ac > 30 ||
      !Number.isFinite(maxHP) ||
      maxHP < 0 ||
      !Number.isFinite(profBonus) ||
      profBonus < 0 ||
      profBonus > 6;

    if (hasErrors) {
      return null;
    }

    return {
      name,
      ac: clamp(ac, 1, 30),
      maxHP: Math.max(0, maxHP),
      profBonus: clamp(profBonus, 0, 6),
      abilities: abilities as AbilityScores,
    };
  }

  private async handleSubmit(): Promise<void> {
    if (!this.currentActorId || this.loading) {
      return;
    }

    this.clearErrors();
    const values = this.collectFormValues();
    if (!values) {
      this.setStatus("Проверьте введённые данные", "error");
      return;
    }

    const patch: ActorPatchPayload = {};
    const current = this.currentActor;

    if (!current || values.name !== current.name) {
      patch.name = values.name;
    }
    if (!current || values.ac !== current.ac) {
      patch.ac = values.ac;
    }
    if (!current || values.maxHP !== current.maxHP) {
      patch.maxHP = values.maxHP;
    }
    if (!current || values.profBonus !== current.profBonus) {
      patch.profBonus = values.profBonus;
    }

    const abilityUpdates: Partial<AbilityScores> = {};
    let hasAbilityUpdates = false;
    for (const ability of ABILITY_KEYS) {
      const currentScore = current?.abilities?.[ability];
      const nextScore = values.abilities[ability];
      if (currentScore !== nextScore) {
        abilityUpdates[ability] = nextScore;
        hasAbilityUpdates = true;
      }
    }
    if (hasAbilityUpdates) {
      patch.abilities = abilityUpdates;
    }

    if (Object.keys(patch).length === 0) {
      this.setStatus("Изменений не обнаружено", "success");
      return;
    }

    this.setLoading(true);
    this.setStatus("Сохраняем изменения…");

    try {
      const actor = await this.options.updateActor(this.currentActorId, patch);
      this.currentActor = actor;
      this.populateForm(actor);
      this.setStatus("Изменения сохранены", "success");
      this.options.onActorUpdated?.(actor);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось сохранить изменения";
      this.setStatus(message, "error");

      if (error instanceof ActorsApiError && error.details) {
        for (const [key, detail] of Object.entries(error.details)) {
          if (key === "abilities") {
            this.setStatus(detail, "error");
            continue;
          }
          this.setFieldError(key, detail);
        }
      }
    } finally {
      this.setLoading(false);
    }
  }
}
