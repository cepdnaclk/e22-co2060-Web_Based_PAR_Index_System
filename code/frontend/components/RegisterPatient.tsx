import React, { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeftIcon,
  UserPlusIcon,
  CheckCircleIcon,
  LoaderIcon,
} from 'lucide-react'
interface RegisterPatientProps {
  onBack: () => void
}
interface FormData {
  name: string
  dateOfBirth: string
  gender: string
  assignedDoctor: string
  notes: string
}
interface FormErrors {
  name?: string
  dateOfBirth?: string
  gender?: string
  assignedDoctor?: string
}
type FormStatus = 'idle' | 'submitting' | 'success'
const doctors = ['Dr. Chen', 'Dr. Patel', 'Dr. Nakamura']
const genders = ['Male', 'Female', 'Other']
const inputBase =
  'w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 transition-all duration-150 placeholder:text-gray-400'
const inputNormal =
  'border-gray-200 focus:ring-blue-500/20 focus:border-blue-400'
const inputError = 'border-red-300 focus:ring-red-500/20 focus:border-red-400'
export function RegisterPatient({ onBack }: RegisterPatientProps) {
  const [form, setForm] = useState<FormData>({
    name: '',
    dateOfBirth: '',
    gender: '',
    assignedDoctor: '',
    notes: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<FormStatus>('idle')
  const validateField = useCallback(
    (field: keyof FormErrors, value: string): string | undefined => {
      switch (field) {
        case 'name':
          return value.trim() ? undefined : 'Patient name is required'
        case 'dateOfBirth':
          return value ? undefined : 'Date of birth is required'
        case 'gender':
          return value ? undefined : 'Please select a gender'
        case 'assignedDoctor':
          return value ? undefined : 'Please select a doctor'
        default:
          return undefined
      }
    },
    [],
  )
  const handleChange = useCallback(
    (field: keyof FormData, value: string) => {
      setForm((prev) => ({
        ...prev,
        [field]: value,
      }))
      if (touched[field]) {
        const error = validateField(field as keyof FormErrors, value)
        setErrors((prev) => ({
          ...prev,
          [field]: error,
        }))
      }
    },
    [touched, validateField],
  )
  const handleBlur = useCallback(
    (field: keyof FormErrors) => {
      setTouched((prev) => ({
        ...prev,
        [field]: true,
      }))
      const error = validateField(field, form[field])
      setErrors((prev) => ({
        ...prev,
        [field]: error,
      }))
    },
    [form, validateField],
  )
  const isValid =
    form.name.trim() !== '' &&
    form.dateOfBirth !== '' &&
    form.gender !== '' &&
    form.assignedDoctor !== ''
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!isValid) return
      setStatus('submitting')
      setTimeout(() => {
        setStatus('success')
      }, 600)
    },
    [isValid],
  )
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{
            opacity: 0,
            y: -8,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.25,
          }}
          className="mb-6"
        >
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors mb-4 group"
          >
            <ArrowLeftIcon
              size={15}
              className="transition-transform duration-150 group-hover:-translate-x-0.5"
            />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
              <UserPlusIcon size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Register New Patient
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Enter patient details to create a new case
              </p>
            </div>
          </div>
        </motion.div>

        {/* Form / Success */}
        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div
              key="success"
              initial={{
                opacity: 0,
                scale: 0.95,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              transition={{
                duration: 0.35,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center"
            >
              <motion.div
                initial={{
                  scale: 0,
                }}
                animate={{
                  scale: 1,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 20,
                  delay: 0.1,
                }}
                className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5"
              >
                <CheckCircleIcon size={32} className="text-emerald-500" />
              </motion.div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Patient Registered Successfully
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                <span className="font-medium text-gray-700">{form.name}</span>{' '}
                has been added to your case list and assigned to{' '}
                <span className="font-medium text-gray-700">
                  {form.assignedDoctor}
                </span>
                .
              </p>
              <button
                onClick={onBack}
                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors duration-150"
              >
                Back to Dashboard
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              initial={{
                opacity: 0,
                y: 12,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -12,
              }}
              transition={{
                duration: 0.3,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="p-6 space-y-5">
                {/* Patient Name */}
                <div>
                  <label
                    htmlFor="patient-name"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Patient Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="patient-name"
                    type="text"
                    placeholder="e.g. Sarah Mitchell"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    onBlur={() => handleBlur('name')}
                    className={`${inputBase} ${errors.name && touched.name ? inputError : inputNormal}`}
                  />
                  {errors.name && touched.name && (
                    <motion.p
                      initial={{
                        opacity: 0,
                        y: -4,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      className="text-xs text-red-500 mt-1.5"
                    >
                      {errors.name}
                    </motion.p>
                  )}
                </div>

                {/* Date of Birth + Gender row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="patient-dob"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Date of Birth <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="patient-dob"
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) =>
                        handleChange('dateOfBirth', e.target.value)
                      }
                      onBlur={() => handleBlur('dateOfBirth')}
                      className={`${inputBase} ${errors.dateOfBirth && touched.dateOfBirth ? inputError : inputNormal}`}
                    />
                    {errors.dateOfBirth && touched.dateOfBirth && (
                      <motion.p
                        initial={{
                          opacity: 0,
                          y: -4,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        className="text-xs text-red-500 mt-1.5"
                      >
                        {errors.dateOfBirth}
                      </motion.p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="patient-gender"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Gender <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="patient-gender"
                      value={form.gender}
                      onChange={(e) => handleChange('gender', e.target.value)}
                      onBlur={() => handleBlur('gender')}
                      className={`${inputBase} ${errors.gender && touched.gender ? inputError : inputNormal} ${!form.gender ? 'text-gray-400' : 'text-gray-900'}`}
                    >
                      <option value="" disabled>
                        Select gender
                      </option>
                      {genders.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                    {errors.gender && touched.gender && (
                      <motion.p
                        initial={{
                          opacity: 0,
                          y: -4,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        className="text-xs text-red-500 mt-1.5"
                      >
                        {errors.gender}
                      </motion.p>
                    )}
                  </div>
                </div>

                {/* Assigned Doctor */}
                <div>
                  <label
                    htmlFor="patient-doctor"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Assigned Doctor <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="patient-doctor"
                    value={form.assignedDoctor}
                    onChange={(e) =>
                      handleChange('assignedDoctor', e.target.value)
                    }
                    onBlur={() => handleBlur('assignedDoctor')}
                    className={`${inputBase} ${errors.assignedDoctor && touched.assignedDoctor ? inputError : inputNormal} ${!form.assignedDoctor ? 'text-gray-400' : 'text-gray-900'}`}
                  >
                    <option value="" disabled>
                      Select a doctor
                    </option>
                    {doctors.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {errors.assignedDoctor && touched.assignedDoctor && (
                    <motion.p
                      initial={{
                        opacity: 0,
                        y: -4,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      className="text-xs text-red-500 mt-1.5"
                    >
                      {errors.assignedDoctor}
                    </motion.p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label
                    htmlFor="patient-notes"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Notes{' '}
                    <span className="text-gray-400 font-normal">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="patient-notes"
                    rows={3}
                    placeholder="Initial observations, referral notes, etc."
                    value={form.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    className={`${inputBase} ${inputNormal} resize-none`}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-150"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isValid || status === 'submitting'}
                  className={`
                    flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-150
                    ${isValid && status !== 'submitting' ? 'text-white bg-blue-600 hover:bg-blue-700 shadow-sm' : 'text-gray-400 bg-gray-100 cursor-not-allowed'}
                  `}
                >
                  {status === 'submitting' ? (
                    <>
                      <LoaderIcon size={15} className="animate-spin" />
                      Registering…
                    </>
                  ) : (
                    <>
                      <UserPlusIcon size={15} />
                      Register Patient
                    </>
                  )}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
