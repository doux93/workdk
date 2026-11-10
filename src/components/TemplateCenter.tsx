"use client";
import React from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  Plus,
  Headphones,
  Mic,
  Languages,
} from "lucide-react";
import {
  type Module,
  type Workspace,
  views,
  learningPresets,
  createModuleFromLearningPreset,
} from "../workspace";
import { Icon, MiniLayout } from "./shared";
export default function TemplateCenter({
  data,
  navigate,
  onLayoutChange,
  onCreate,
}: {
  data: Workspace;
  navigate: (path: string) => void;
  onLayoutChange: (layout: Workspace["layout"], name: string) => void;
  onCreate: (module: Module) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE IT YOURS</div>
          <h1>
            换个样子，继续热爱<span className="title-dot">.</span>
          </h1>
          <p>布局可以改变，你的内容始终保留。</p>
        </div>
        <div className="button-row">
          <button
            className="button"
            onClick={() =>
              document
                .getElementById("english-learning-templates")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            <Languages size={16} />
            英语学习<span className="template-count">4</span>
          </button>
          <button className="button" onClick={() => navigate("home")}>
            <ArrowLeft size={16} />
            返回工作台
          </button>
        </div>
      </div>
      <div className="section-heading">
        <h2>
          首页布局<span>选择适合当下工作节奏的空间</span>
        </h2>
        <span className="subtle-label">3 款可替换模板</span>
      </div>
      <div className="template-grid">
        {[
          {
            id: "balanced",
            name: "从容日常",
            tag: "均衡 · 概览",
            desc: "待办、日程与灵感各就其位，轻松掌握每一天。",
          },
          {
            id: "focus",
            name: "心流时刻",
            tag: "专注 · 大留白",
            desc: "让任务成为主角，减少干扰，留出更多思考空间。",
          },
          {
            id: "compact",
            name: "高效掌控",
            tag: "紧凑 · 高密度",
            desc: "在一屏中容纳更多信息，快速切换不同的工作。",
          },
        ].map((t) => (
          <article
            className={
              "template-card " + (data.layout === t.id ? "selected" : "")
            }
            key={t.id}
          >
            <div className="template-preview">
              <MiniLayout type={t.id} />
              {data.layout === t.id && (
                <span className="using-badge">
                  <Check size={12} />
                  正在使用
                </span>
              )}
            </div>
            <div className="template-info">
              <span className="tiny-label">{t.tag}</span>
              <h3>{t.name}</h3>
              <p>{t.desc}</p>
              <button
                className={"button " + (data.layout === t.id ? "" : "primary")}
                onClick={() => {
                  onLayoutChange(t.id as Workspace["layout"], t.name);
                }}
              >
                {data.layout === t.id ? (
                  <>
                    <Check size={15} />
                    当前模板
                  </>
                ) : (
                  <>
                    应用模板
                    <ArrowUpRight size={15} />
                  </>
                )}
              </button>
            </div>
          </article>
        ))}
      </div>
      <section id="english-learning-templates" className="learning-section">
        <div className="section-heading">
          <h2>
            <Languages size={18} />
            英语学习<span>每天一点，慢慢变成自己的表达</span>
          </h2>
          <span className="subtle-label">4 款学习模板</span>
        </div>
        <div className="learning-template-grid">
          {learningPresets.map((preset) => (
            <article
              className={"learning-template-card learning-" + preset.id}
              key={preset.id}
            >
              <div
                className={"learning-art tone-" + preset.color}
                aria-hidden="true"
              >
                <span className="learning-art-label">{preset.english}</span>
                {preset.id === "vocabulary" ? (
                  <div className="word-preview">
                    <b>
                      clarify<span>v.</span>
                    </b>
                    <p>澄清 · 讲清楚</p>
                    <small>Could you clarify the deadline?</small>
                  </div>
                ) : preset.id === "daily-english" ? (
                  <div className="habit-preview">
                    <div>
                      {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                        <span key={index}>
                          <small>{day}</small>
                          <i
                            className={
                              index < 2
                                ? "checked"
                                : index === 2
                                  ? "current"
                                  : ""
                            }
                          >
                            {index < 2 ? (
                              <Check size={15} />
                            ) : index === 2 ? (
                              "15′"
                            ) : (
                              "·"
                            )}
                          </i>
                        </span>
                      ))}
                    </div>
                    <p>A little progress, every day.</p>
                  </div>
                ) : preset.id === "listening-reading" ? (
                  <div className="listening-preview">
                    <span className="listening-play">
                      <Headphones size={24} />
                    </span>
                    <div className="sound-wave">
                      {[
                        13, 25, 36, 20, 44, 32, 17, 29, 42, 23, 14, 31, 20, 37,
                        15,
                      ].map((height, index) => (
                        <i key={index} style={{ height }} />
                      ))}
                    </div>
                    <p>听见表达，也听懂语境。</p>
                  </div>
                ) : (
                  <div className="speaking-preview">
                    <span>
                      <Mic size={17} />
                      Could you clarify…?
                    </span>
                    <p>Say it in your own words.</p>
                  </div>
                )}
              </div>
              <div className="learning-card-content">
                <div className="learning-card-title">
                  <h3>
                    <Icon name={preset.icon} size={18} />
                    {preset.name}
                  </h3>
                  <span>
                    {views.find((v) => v.id === preset.view)?.name.slice(2)}
                    视图
                  </span>
                </div>
                <p>{preset.description}</p>
                <div className="learning-field-tags">
                  {preset.fields.map((field) => (
                    <span key={field}>{field}</span>
                  ))}
                </div>
                <div className="learning-card-footer">
                  <small>
                    {preset.examples.length} 条可选示例 · 字段可修改
                  </small>
                  <button
                    className="button"
                    aria-label={"使用" + preset.name + "模板"}
                    onClick={() => {
                      onCreate({
                        ...createModuleFromLearningPreset(preset.id),
                        id: "",
                      });
                    }}
                  >
                    使用模板
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <div className="section-heading spaced">
        <h2>
          模块页面模板<span>同一份内容，用不同的方式看待</span>
        </h2>
      </div>
      <div className="view-template-grid">
        {views.map((v) => (
          <button
            key={v.id}
            className="view-template-card"
            onClick={() => {
              onCreate({
                id: "",
                name: "",
                description: "",
                view: v.id,
                icon:
                  v.id === "list"
                    ? "check"
                    : v.id === "board"
                      ? "folder"
                      : v.id === "notes"
                        ? "note"
                        : v.id === "links"
                          ? "link"
                          : "calendar",
                color: "green",
                fields: [],
                hidden: false,
                entries: [],
              });
            }}
          >
            <div className="view-demo">
              <Icon name={v.icon} size={33} />
              <div>
                <i />
                <i />
                <i />
              </div>
            </div>
            <h3>{v.name}</h3>
            <p>{v.description}</p>
            <span>
              使用此模板创建模块 <Plus size={14} />
            </span>
          </button>
        ))}
      </div>
      <div className="info-banner">
        <CheckCheck size={21} />
        <div>
          <b>自由换模板，内容不搬家</b>
          <p>
            已有模块可在页面右上方直接切换视图。标题、正文、自定义字段和状态都会保留。
          </p>
        </div>
      </div>
    </>
  );
}
