# Hexagonal omikuji box (御神籤筒) + one fortune stick, exported as GLB for three.js.
# Blender Z-up, front = -Y. Exported Y-up (three.js +Z = front).
import bpy, bmesh, math, sys
OUT = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)

def hexrgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1,)
def mat(name, hexc, metal=0., rough=.5, coat=0.):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = hexrgb(hexc); p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    if coat: p.inputs['Coat Weight'].default_value = coat; p.inputs['Coat Roughness'].default_value = .2
    return m
WOOD, IRON, LABEL, HOLE, STICK = mat('Wood', '#FFFFFF', 0, .55, .25), mat('Iron', '#1E1C1A', .6, .42), mat('Label', '#FFFFFF', 0, .45), mat('Hole', '#120A04', 0, .9), mat('StickWood', '#FFFFFF', 0, .6)

def finish(o, m, bevel=0., seg=2, smooth_angle=None):
    o.data.materials.clear(); o.data.materials.append(m)
    if bevel:
        b = o.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = seg; b.limit_method = 'ANGLE'
    for p in o.data.polygons: p.use_smooth = True
    try: o.modifiers.new('wn', 'WEIGHTED_NORMAL').keep_sharp = True
    except Exception: pass
    bpy.context.view_layer.objects.active = o
    for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

R, Hh = .5, 1.5
# body: hexagonal prism with a flat face to the front
bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=R, depth=Hh, location=(0, 0, Hh / 2))
body = bpy.context.active_object; body.name = 'Tube'
body.rotation_euler = (0, 0, math.pi / 6); bpy.ops.object.transform_apply(rotation=True)   # a flat face to the front
# pocket for the hole on the lid
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=.06, depth=.2, location=(0, 0, Hh))
cut = bpy.context.active_object
bo = body.modifiers.new('hole', 'BOOLEAN'); bo.object = cut; bo.operation = 'DIFFERENCE'
bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier='hole'); bpy.data.objects.remove(cut)
finish(body, WOOD, .018, 2)
# dark disc at the bottom of the hole
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=.06, depth=.01, location=(0, 0, Hh - .09)); finish(bpy.context.active_object, HOLE).name = 'HoleDark'
# iron bands
for z in (.16, Hh - .16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=R * 1.035, depth=.07, location=(0, 0, z), rotation=(0, 0, math.pi / 6))
    finish(bpy.context.active_object, IRON, .01, 2).name = 'Band'
# red label plate on the front face
ap = R * math.cos(math.radians(30))
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -(ap + .006), Hh * .5))
lab = bpy.context.active_object; lab.scale = (.24, .74, 1); lab.rotation_euler = (math.pi / 2, 0, 0)
bpy.ops.object.transform_apply(scale=True, rotation=True)
finish(lab, LABEL).name = 'Label'
# fortune stick (origin at its centre so three.js can drop and spin it)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
st = bpy.context.active_object; st.scale = (.05, .032, 1.3); bpy.ops.object.transform_apply(scale=True)
finish(st, STICK, .012, 2).name = 'Stick'
# join the static box parts
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.name != 'Stick': o.select_set(True)
bpy.context.view_layer.objects.active = bpy.data.objects['Tube']; bpy.ops.object.join()
tris = 0
for o in bpy.data.objects:
    o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles); print(o.name, len(o.data.loop_triangles), [m.name for m in o.data.materials])
print('TRIS', tris)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True, export_texcoords=True, export_normals=True, export_vertex_color='NONE')
