import React, { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { PlusIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import { measurementPoints } from '../data/mockData'
import type { MeasurementPoint } from '../data/mockData'
interface PointsTabProps {
  patientId: string
}
interface EditingCell {
  rowId: string
  field: keyof MeasurementPoint
}

export function PointTab({ patientId }: PointsTabProps) {
  const initialPoints = measurementPoints[patientId] || []
  const [points, setPoints] = useState<MeasurementPoint[]>(initialPoints)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    setPoints(measurementPoints[patientId] || [])
    setEditingCell(null)
  }, [patientId])
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])
  const startEditing = (
    rowId: string,
    field: keyof MeasurementPoint,
    currentValue: string | number,
  ) => {
    setEditingCell({
      rowId,
      field,
    })
    setEditValue(String(currentValue))
  }
  const commitEdit = () => {
    if (!editingCell) return
    setPoints((prev) =>
      prev.map((p) => {
        if (p.id !== editingCell.rowId) return p
        const numericFields = ['x', 'y', 'z', 'measurement']
        const newValue = numericFields.includes(editingCell.field)
          ? parseFloat(editValue) || 0
          : editValue
        return {
          ...p,
          [editingCell.field]: newValue,
        }
      }),
    )
    setEditingCell(null)
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditingCell(null)
    if (e.key === 'Tab') {
      e.preventDefault()
      commitEdit()
    }
  }
  const addRow = () => {
    const newPoint: MeasurementPoint = {
      id: `mp-new-${Date.now()}`,
      patientId,
      pointId: '',
      location: '',
      x: 0,
      y: 0,
      z: 0,
      measurement: 0,
      notes: '',
    }
    setPoints((prev) => [...prev, newPoint])
    // Auto-focus the first editable cell of the new row
    setTimeout(() => {
      startEditing(newPoint.id, 'pointId', '')
    }, 50)
  }
  const deleteRow = (id: string) => {
    setPoints((prev) => prev.filter((p) => p.id !== id))
  }
  const editableFields: (keyof MeasurementPoint)[] = [
    'pointId',
    'location',
    'x',
    'y',
    'z',
    'measurement',
    'notes',
  ]
  const renderCell = (
    point: MeasurementPoint,
    field: keyof MeasurementPoint,
  ) => {
    const isEditing =
      editingCell?.rowId === point.id && editingCell?.field === field
    const value = point[field]
    const isNumeric = ['x', 'y', 'z', 'measurement'].includes(field)
    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type={isNumeric ? 'number' : 'text'}
          step={isNumeric ? '0.1' : undefined}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-full px-1.5 py-0.5 text-sm bg-blue-50 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums"
        />
      )
    }
    return (
      <button
        onClick={() => startEditing(point.id, field, value)}
        className="w-full text-left px-1.5 py-0.5 text-sm rounded hover:bg-gray-50 transition-colors cursor-text tabular-nums"
        title="Click to edit"
      >
        {isNumeric ? Number(value).toFixed(1) : String(value) || '—'}
      </button>
    )
  }
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Measurement Points
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {points.length} points · Click any cell to edit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <UploadIcon size={13} />
            Import CSV
          </button>
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon size={13} />
            Add Point
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-gray-400 px-3 py-2.5 w-16">
                  ID
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-gray-400 px-3 py-2.5 w-32">
                  Location
                </th>
                <th className="text-right text-[11px] font-medium uppercase tracking-wider text-gray-400 px-3 py-2.5 w-20">
                  X
                </th>
                <th className="text-right text-[11px] font-medium uppercase tracking-wider text-gray-400 px-3 py-2.5 w-20">
                  Y
                </th>
                <th className="text-right text-[11px] font-medium uppercase tracking-wider text-gray-400 px-3 py-2.5 w-20">
                  Z
                </th>
                <th className="text-right text-[11px] font-medium uppercase tracking-wider text-gray-400 px-3 py-2.5 w-24">
                  Measure
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-gray-400 px-3 py-2.5">
                  Notes
                </th>
                <th className="w-10 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, index) => (
                <motion.tr
                  key={point.id}
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  transition={{
                    delay: index * 0.03,
                  }}
                  className="border-b border-gray-50 last:border-0 group"
                >
                  <td className="px-3 py-1.5">
                    {renderCell(point, 'pointId')}
                  </td>
                  <td className="px-3 py-1.5">
                    {renderCell(point, 'location')}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {renderCell(point, 'x')}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {renderCell(point, 'y')}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {renderCell(point, 'z')}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {renderCell(point, 'measurement')}
                  </td>
                  <td className="px-3 py-1.5">{renderCell(point, 'notes')}</td>
                  <td className="px-3 py-1.5">
                    <button
                      onClick={() => deleteRow(point.id)}
                      className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label={`Delete point ${point.pointId}`}
                    >
                      <Trash2Icon size={13} />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {points.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400">
            No measurement points yet. Click "Add Point" to begin.
          </div>
        )}
      </div>
    </div>
  )
}
