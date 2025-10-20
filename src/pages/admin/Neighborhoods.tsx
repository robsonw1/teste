import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NEIGHBORHOOD_OPTIONS, loadAdminNeighborhoods, saveAdminNeighborhoods } from '@/services/deliveryNeighborhoods';
import { loadDefaultOtherFee, saveDefaultOtherFee } from '@/services/deliveryNeighborhoods';

type Neighborhood = {
	key: string;
	label: string;
	aliases?: string[];
	fee: number;
};

const AdminNeighborhoods = () => {
	const [list, setList] = useState<Neighborhood[]>([]);
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const [form, setForm] = useState<Neighborhood>({ key: '', label: '', aliases: [], fee: 0 });
		const [defaultOtherFee, setDefaultOtherFee] = useState<number>(9);

	useEffect(() => {
		try {
			const loaded = loadAdminNeighborhoods();
			setList(loaded as any);
				try {
					setDefaultOtherFee(loadDefaultOtherFee());
				} catch (e) {}
		} catch (e) {
			setList(NEIGHBORHOOD_OPTIONS as any);
		}
	}, []);

	const persist = (next: Neighborhood[]) => {
		setList(next);
		saveAdminNeighborhoods(next as any);
	};

	const handleAdd = () => {
		if (!form.label || !form.key) return;
		const next = [...list, form];
		persist(next);
		setForm({ key: '', label: '', aliases: [], fee: 0 });
	};

	const handleDelete = (index: number) => {
		const next = list.filter((_, i) => i !== index);
		persist(next);
	};

	const handleEdit = (index: number) => {
		setEditingIndex(index);
		setForm(list[index]);
	};

	const handleSaveEdit = () => {
		if (editingIndex === null) return;
		const next = [...list];
		next[editingIndex] = form;
		persist(next);
		setEditingIndex(null);
		setForm({ key: '', label: '', aliases: [], fee: 0 });
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Gerenciar Bairros de Entrega</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="mb-4">
						<div className="grid grid-cols-3 gap-4">
							<div>
								<Label>Chave (id)</Label>
								<Input value={form.key} onChange={(e) => setForm({...form, key: e.target.value})} placeholder="ex: eden" />
							</div>
							<div>
								<Label>Nome</Label>
								<Input value={form.label} onChange={(e) => setForm({...form, label: e.target.value})} placeholder="Ex: Éden" />
							</div>
							<div>
								<Label>Taxa (R$)</Label>
								<Input type="number" value={String(form.fee)} onChange={(e) => setForm({...form, fee: Number(e.target.value)})} placeholder="4" />
							</div>
						</div>
									<div className="mt-4 grid grid-cols-2 gap-4 items-end">
										<div>
											<Label>Taxa padrão para "Outros" (R$)</Label>
											<Input type="number" value={String(defaultOtherFee)} onChange={(e) => setDefaultOtherFee(Number(e.target.value))} />
										</div>
														<div>
															<Button onClick={() => { saveDefaultOtherFee(defaultOtherFee); /* saved */ }} className="mt-1">Salvar taxa padrão</Button>
														</div>
									</div>
						<div className="mt-3 flex gap-2">
							{editingIndex === null ? (
								<Button onClick={handleAdd}>Adicionar</Button>
							) : (
								<>
									<Button onClick={handleSaveEdit}>Salvar</Button>
									<Button variant="outline" onClick={() => { setEditingIndex(null); setForm({ key: '', label: '', aliases: [], fee: 0 }); }}>Cancelar</Button>
								</>
							)}
						</div>
					</div>

					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Chave</TableHead>
								<TableHead>Nome</TableHead>
								<TableHead>Taxa (R$)</TableHead>
								<TableHead>Ações</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{list.map((n, idx) => (
								<TableRow key={n.key}>
									<TableCell>{n.key}</TableCell>
									<TableCell>{n.label}</TableCell>
									<TableCell>R$ {Number(n.fee).toFixed(2).replace('.', ',')}</TableCell>
									<TableCell>
										<div className="flex gap-2">
											<Button size="sm" onClick={() => handleEdit(idx)}>Editar</Button>
											<Button size="sm" variant="destructive" onClick={() => handleDelete(idx)}>Remover</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
};

export default AdminNeighborhoods;
