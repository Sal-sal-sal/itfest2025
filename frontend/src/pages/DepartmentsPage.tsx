import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  RefreshCw,
  Tag,
  Building2,
  ArrowLeft,
  X,
} from 'lucide-react'
import { departmentsApi, categoriesApi, type Department, type Category } from '../api/client'

export const DepartmentsPage = () => {
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)

  const [deptForm, setDeptForm] = useState({
    name: '',
    name_kz: '',
    description: '',
    keywords: '',
  })

  const [catForm, setCatForm] = useState({
    name: '',
    name_kz: '',
    description: '',
    department_id: '',
    auto_response_template: '',
  })

  const fetchData = async () => {
    try {
      setLoading(true)
      const [deptsRes, catsRes] = await Promise.all([
        departmentsApi.list(),
        categoriesApi.list(),
      ])
      setDepartments(deptsRes.data)
      setCategories(catsRes.data)
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await departmentsApi.create({
        name: deptForm.name,
        name_kz: deptForm.name_kz || undefined,
        description: deptForm.description || undefined,
        keywords: deptForm.keywords ? deptForm.keywords.split(',').map((k) => k.trim()) : undefined,
      })
      setShowDeptModal(false)
      setDeptForm({ name: '', name_kz: '', description: '', keywords: '' })
      await fetchData()
    } catch (err) {
      console.error('Failed to create department:', err)
    }
  }

  const handleCreateCat = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await categoriesApi.create({
        name: catForm.name,
        name_kz: catForm.name_kz || undefined,
        description: catForm.description || undefined,
        department_id: catForm.department_id || undefined,
        auto_response_template: catForm.auto_response_template || undefined,
      })
      setShowCatModal(false)
      setCatForm({ name: '', name_kz: '', description: '', department_id: '', auto_response_template: '' })
      await fetchData()
    } catch (err) {
      console.error('Failed to create category:', err)
    }
  }

  const getCategoriesByDept = (deptId: string) => {
    return categories.filter((c) => c.department_id === deptId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="rounded-lg p-2 text-muted transition hover:bg-surface/80 hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Департаменты и категории</h1>
            <p className="mt-1 text-muted">Настройка маршрутизации обращений</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface/80"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCatModal(true)}
            className="flex items-center gap-2 rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface/80"
          >
            <Tag className="h-4 w-4" />
            Категория
          </button>
          <button
            onClick={() => setShowDeptModal(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" />
            Департамент
          </button>
        </div>
      </div>

      {/* Departments Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="rounded-2xl border border-border/30 bg-surface/70 p-6 shadow-sm transition hover:shadow-soft"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10">
                    <Building2 className="h-6 w-6 text-brand-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{dept.name}</h3>
                    {dept.name_kz && (
                      <p className="text-sm text-muted">{dept.name_kz}</p>
                    )}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    dept.is_active
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                      : 'bg-red-500/10 text-red-600 dark:text-red-300'
                  }`}
                >
                  {dept.is_active ? 'Активен' : 'Неактивен'}
                </span>
              </div>

              {dept.description && (
                <p className="mt-3 text-sm text-muted">{dept.description}</p>
              )}

              {/* Categories */}
              <div className="mt-4 border-t border-border/20 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Категории</span>
                  <span className="text-foreground">{getCategoriesByDept(dept.id).length}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {getCategoriesByDept(dept.id).map((cat) => (
                    <span
                      key={cat.id}
                      className="rounded-full bg-surface px-3 py-1 text-xs text-foreground"
                    >
                      {cat.name}
                    </span>
                  ))}
                  {getCategoriesByDept(dept.id).length === 0 && (
                    <span className="text-xs text-muted">Нет категорий</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Department Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/30 bg-surface p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Новый департамент</h2>
              <button
                onClick={() => setShowDeptModal(false)}
                className="rounded-lg p-1 text-muted hover:bg-surface/80 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateDept} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Название (RU) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-border/50 bg-background/50 px-4 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Название (KZ)
                </label>
                <input
                  type="text"
                  value={deptForm.name_kz}
                  onChange={(e) => setDeptForm({ ...deptForm, name_kz: e.target.value })}
                  className="w-full rounded-lg border border-border/50 bg-background/50 px-4 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Описание
                </label>
                <textarea
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border/50 bg-background/50 px-4 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Ключевые слова (через запятую)
                </label>
                <input
                  type="text"
                  value={deptForm.keywords}
                  onChange={(e) => setDeptForm({ ...deptForm, keywords: e.target.value })}
                  placeholder="компьютер, пароль, принтер"
                  className="w-full rounded-lg border border-border/50 bg-background/50 px-4 py-2 text-sm text-foreground"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-foreground"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/30 bg-surface p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Новая категория</h2>
              <button
                onClick={() => setShowCatModal(false)}
                className="rounded-lg p-1 text-muted hover:bg-surface/80 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCat} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Название (RU) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-border/50 bg-background/50 px-4 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Название (KZ)
                </label>
                <input
                  type="text"
                  value={catForm.name_kz}
                  onChange={(e) => setCatForm({ ...catForm, name_kz: e.target.value })}
                  className="w-full rounded-lg border border-border/50 bg-background/50 px-4 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Департамент
                </label>
                <select
                  value={catForm.department_id}
                  onChange={(e) => setCatForm({ ...catForm, department_id: e.target.value })}
                  className="w-full rounded-lg border border-border/50 bg-background/50 px-4 py-2 text-sm text-foreground"
                >
                  <option value="">Без департамента</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Шаблон автоответа
                </label>
                <textarea
                  value={catForm.auto_response_template}
                  onChange={(e) => setCatForm({ ...catForm, auto_response_template: e.target.value })}
                  rows={3}
                  placeholder="Текст автоматического ответа для этой категории"
                  className="w-full resize-none rounded-lg border border-border/50 bg-background/50 px-4 py-2 text-sm text-foreground"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-foreground"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

